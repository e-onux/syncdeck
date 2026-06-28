#!/usr/bin/env node
// SyncDeck MCP server — exposes the rclone-backed engine to LLM agents through a
// strict, read-only + dry-run tool set. The security model is the point: a naive
// "rclone over MCP" is trivial and dangerous, so every agent-supplied value is
// validated by the SAME policy helpers the GUI uses (shared engine.cjs), there is
// a remote allowlist, secrets are redacted, and nothing here mutates remote data.
//
// Phase 2 (not in this MVP) adds mutating tools (upload/download/run_profile)
// behind an app-side approval queue — see docs/mcp-server.md.

import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// Single source of truth for arg-safety / path validation / redaction, shared
// with the Electron app so the MCP path and GUI path can never drift apart.
const require = createRequire(import.meta.url)
const engine = require('../../app/electron/lib/engine.cjs')
const { splitArgs, normalizeMode, supportsEmptyDirs, assertSafeMcpArgs, parseRemoteTarget, redactConfigDump } = engine

const APP_NAME = 'SyncDeck'

// ---- locate SyncDeck's config + the rclone engine (standalone process) ----
function userDataDir() {
  if (process.env.SYNCDECK_CONFIG_DIR) return process.env.SYNCDECK_CONFIG_DIR
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME)
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_NAME)
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME)
}
const configPath = () => path.join(userDataDir(), 'profiles.json')
const auditPath = () => path.join(userDataDir(), 'mcp-audit.log')

function findRclone() {
  const exe = process.platform === 'win32' ? 'rclone.exe' : 'rclone'
  const candidates = [
    process.env.SYNCDECK_RCLONE,
    process.env.RCLONE_PATH,
    path.join(userDataDir(), 'engine', exe),
  ].filter(Boolean)
  for (const candidate of candidates) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
      /* try next */
    }
  }
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['rclone'], { encoding: 'utf8' })
  return which.status === 0 ? which.stdout.split(/\r?\n/)[0].trim() : 'rclone'
}
const RCLONE = findRclone()

// Remote allowlist (bare names). Empty => every configured remote is allowed.
const ALLOWED_REMOTES = (process.env.SYNCDECK_MCP_REMOTES || '')
  .split(',')
  .map((s) => s.trim().replace(/:$/, ''))
  .filter(Boolean)

async function readConfig() {
  try {
    return JSON.parse(await fsp.readFile(configPath(), 'utf8'))
  } catch {
    return { profiles: [], lastRun: {} }
  }
}

async function audit(tool, input) {
  try {
    await fsp.mkdir(userDataDir(), { recursive: true })
    await fsp.appendFile(auditPath(), `${new Date().toISOString()} ${tool} ${JSON.stringify(input || {})}\n`)
  } catch {
    /* auditing is best-effort */
  }
}

// Run rclone, resolving { stdout, stderr } on success. JSON tools read stdout;
// dry-run reads both (rclone logs "would do" lines to stderr).
function runRclone(args, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(RCLONE, args, { env: process.env })
    let out = ''
    let err = ''
    child.stdout.on('data', (c) => {
      out += c.toString()
    })
    child.stderr.on('data', (c) => {
      err += c.toString()
    })
    let done = false
    const settle = (fn, value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      fn(value)
    }
    const timer = setTimeout(() => {
      child.kill()
      settle(reject, new Error('rclone zaman aşımı.'))
    }, timeoutMs)
    child.on('error', (e) => settle(reject, e))
    child.on('close', (code) =>
      code === 0
        ? settle(resolve, { stdout: out, stderr: err })
        : settle(reject, new Error((err || out || `çıkış kodu ${code}`).trim().split(/\r?\n/).pop())),
    )
  })
}

const asText = (value) => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

// ---- tools (read-only + dry-run only) ----
const TOOLS = [
  { name: 'list_profiles', description: 'List configured SyncDeck sync profiles (read-only).', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_profile_status', description: 'Last run result (ok/code/finishedAt + log tail) for a profile id.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Profile id' } }, required: ['id'] } },
  { name: 'list_clients', description: 'List configured rclone remotes (name + type). Secrets are redacted.', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_remote_folder', description: 'List one remote folder. path = "remote:sub/dir".', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'remote:sub/dir' } }, required: ['path'] } },
  { name: 'search_remote', description: 'Recursively list a remote and return files whose path contains the query substring.', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'remote:sub/dir' }, query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['path', 'query'] } },
  { name: 'about_remote', description: 'Quota / usage for a remote (rclone about). Not all backends support it.', inputSchema: { type: 'object', properties: { remote: { type: 'string', description: 'remote name' } }, required: ['remote'] } },
  { name: 'run_profile_dry_run', description: 'Run a profile with --dry-run: reports what WOULD change. Makes NO changes.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Profile id' } }, required: ['id'] } },
]

const handlers = {
  async list_profiles() {
    const cfg = await readConfig()
    return asText(
      (cfg.profiles || []).map((p) => ({
        id: p.id,
        name: p.name,
        source: p.source,
        destination: p.destination,
        mode: p.mode,
        intervalMinutes: p.intervalMinutes,
        enabled: p.enabled,
      })),
    )
  },

  async get_profile_status({ id }) {
    const cfg = await readConfig()
    const run = (cfg.lastRun || {})[id]
    if (!run) return asText(`Profil "${id}" için çalışma kaydı yok.`)
    return asText({
      ok: run.ok,
      code: run.code,
      finishedAt: run.finishedAt,
      output: String(run.output || '').split(/\r?\n/).slice(-20).join('\n'),
    })
  },

  async list_clients() {
    const { stdout } = await runRclone(['config', 'dump'])
    const redacted = redactConfigDump(JSON.parse(stdout || '{}'))
    let entries = Object.entries(redacted).map(([name, value]) => ({ name, type: value.type || '' }))
    if (ALLOWED_REMOTES.length) entries = entries.filter((e) => ALLOWED_REMOTES.includes(e.name))
    return asText(entries)
  },

  async list_remote_folder({ path: target }) {
    const parsed = parseRemoteTarget(target, ALLOWED_REMOTES)
    const { stdout } = await runRclone(['lsjson', parsed.path])
    const items = JSON.parse(stdout || '[]').map((e) => ({ name: e.Name, isDir: Boolean(e.IsDir), size: e.Size }))
    return asText(items)
  },

  async search_remote({ path: target, query, maxResults = 100 }) {
    const parsed = parseRemoteTarget(target, ALLOWED_REMOTES)
    const { stdout } = await runRclone(['lsf', '-R', '--files-only', parsed.path], { timeoutMs: 60000 })
    const needle = String(query || '').toLowerCase()
    const limit = Math.max(1, Math.min(1000, Number(maxResults) || 100))
    const hits = stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => line.toLowerCase().includes(needle))
      .slice(0, limit)
    return asText(hits)
  },

  async about_remote({ remote }) {
    const parsed = parseRemoteTarget(`${String(remote).replace(/:$/, '')}:`, ALLOWED_REMOTES)
    const { stdout } = await runRclone(['about', parsed.path, '--json'])
    return asText(JSON.parse(stdout || '{}'))
  },

  async run_profile_dry_run({ id }) {
    const cfg = await readConfig()
    const profile = (cfg.profiles || []).find((p) => p.id === id)
    if (!profile) throw new Error(`Profil bulunamadı: ${id}`)
    const command = normalizeMode(profile.mode)
    // Sanitize the stored extraArgs through the shared denylist before running.
    const extra = assertSafeMcpArgs(splitArgs(profile.extraArgs || ''))
    const args = [
      command,
      profile.source,
      profile.destination,
      ...(supportsEmptyDirs(command) ? ['--create-empty-src-dirs'] : []),
      '--dry-run',
      '-v',
      '--stats=0',
      ...extra,
    ]
    const { stdout, stderr } = await runRclone(args, { timeoutMs: 120000 })
    return asText(`${stdout}${stderr}`.trim() || 'Dry-run tamamlandı (değişiklik yok).')
  },
}

async function main() {
  const server = new Server({ name: 'syncdeck-mcp', version: '0.1.0' }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name
    const input = req.params.arguments || {}
    await audit(name, input)
    const fn = handlers[name]
    if (!fn) return { content: [{ type: 'text', text: `Bilinmeyen araç: ${name}` }], isError: true }
    try {
      return await fn(input)
    } catch (error) {
      return { content: [{ type: 'text', text: `Hata: ${error.message}` }], isError: true }
    }
  })

  // stdout is the MCP channel — only diagnostics may go to stderr.
  process.stderr.write(`syncdeck-mcp: engine=${RCLONE} config=${configPath()} allowlist=${ALLOWED_REMOTES.join(',') || '(all)'}\n`)
  await server.connect(new StdioServerTransport())
}

main().catch((error) => {
  process.stderr.write(`syncdeck-mcp fatal: ${error.message}\n`)
  process.exit(1)
})
