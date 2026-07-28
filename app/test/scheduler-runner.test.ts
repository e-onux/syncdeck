import { EventEmitter } from 'node:events'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildRcloneArgs,
  findRclone,
  parseCliArgs,
  runDueProfiles,
  runRcloneProfile,
} from '../electron/scheduler-runner.cjs'

const FIXED_NOW = Date.parse('2026-07-15T12:00:00.000Z')

type TestProfile = {
  id: string
  enabled: boolean
  intervalMinutes: number
  mode?: string
  source?: string
  destination?: string
  extraArgs?: string
}

type TestRunRecord = {
  ok?: boolean
  code?: number
  output?: string
  finishedAt?: string
}

type TestAuthAlert = { message: string; detectedAt: string }

type TestConfig = {
  profiles: TestProfile[]
  lastRun: Record<string, TestRunRecord>
  bisyncReady: Record<string, boolean>
  authAlerts: Record<string, TestAuthAlert>
}

function memoryConfig(initial: TestConfig) {
  let value = structuredClone(initial)
  return {
    readConfig: async () => structuredClone(value),
    writeConfig: async (next: TestConfig) => {
      value = structuredClone(next)
    },
    current: () => structuredClone(value),
  }
}

describe('scheduler runner CLI', () => {
  it('requires and parses all Electron-derived paths explicitly', () => {
    expect(
      parseCliArgs([
        '--user-data',
        '/tmp/SyncDeck',
        '--app-path=/Applications/SyncDeck.app/Contents/Resources/app.asar',
        '--resources-path',
        '/Applications/SyncDeck.app/Contents/Resources',
      ]),
    ).toEqual({
      userData: '/tmp/SyncDeck',
      appPath: '/Applications/SyncDeck.app/Contents/Resources/app.asar',
      resourcesPath: '/Applications/SyncDeck.app/Contents/Resources',
    })
    expect(() => parseCliArgs(['--user-data', '/tmp/SyncDeck'])).toThrow('--app-path')
    expect(() =>
      parseCliArgs([
        '--user-data',
        '/tmp/SyncDeck',
        '--app-path',
        '/tmp/app.asar',
        '--resources-path',
        '/tmp/resources',
        '--unexpected',
      ]),
    ).toThrow('Bilinmeyen')
  })
})

describe('rclone resolution and invocation', () => {
  it('uses the same managed, resources, app and system candidate order', () => {
    const attempted: string[] = []
    // Built with path.join so separators match whatever OS the test runs on
    // (findRclone joins candidate paths the same way).
    const resourcesRclone = path.join('/bundle/Resources', 'bin', 'darwin', 'arm64', 'rclone')
    const result = findRclone({
      userData: '/data',
      appPath: '/bundle/Resources/app.asar',
      resourcesPath: '/bundle/Resources',
      env: { RCLONE_PATH: '/env/rclone' },
      platform: 'darwin',
      arch: 'arm64',
      accessSync: (candidate: string) => {
        attempted.push(candidate)
        if (candidate !== resourcesRclone) throw new Error('missing')
      },
      spawnSyncImpl: vi.fn(),
    })

    expect(result).toBe(resourcesRclone)
    expect(attempted).toEqual(['/env/rclone', path.join('/data', 'engine', 'rclone'), resourcesRclone])
  })

  it('builds scheduler commands and protects bisync listing checksums', () => {
    expect(
      buildRcloneArgs({
        mode: 'sync',
        source: '/source',
        destination: 'drive:backup',
        extraArgs: '--checksum',
      }),
    ).toEqual([
      'sync',
      '/source',
      'drive:backup',
      '--create-empty-src-dirs',
      '--use-json-log',
      '--stats=1s',
      '-v',
      '--checksum',
    ])

    const bisync = buildRcloneArgs({
      mode: 'bisync',
      source: '/source',
      destination: 'drive:backup',
      extraArgs: '--ignore-listing-checksum --resilient',
    })
    expect(bisync).not.toContain('--ignore-listing-checksum')
    expect(bisync).toContain('--resilient')
  })

  it('runs rclone without Electron and keeps readable logs out of JSON stats', async () => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter
      stderr: EventEmitter
    }
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()
    const spawnImpl = vi.fn(() => {
      queueMicrotask(() => {
        child.stdout.emit('data', '{"stats":{"bytes":1}}\n')
        child.stderr.emit('data', '{"level":"error","object":"a.txt","msg":"retrying"}\n')
        child.emit('close', 0)
      })
      return child
    })

    const result = await runRcloneProfile(
      { mode: 'copy', source: '/source', destination: 'drive:backup', extraArgs: '' },
      { rclonePath: '/usr/local/bin/rclone', spawnImpl, env: { LANG: 'en_US.UTF-8' } },
    )

    expect(spawnImpl).toHaveBeenCalledOnce()
    expect(spawnImpl.mock.calls[0][0]).toBe('/usr/local/bin/rclone')
    expect(spawnImpl.mock.calls[0][2]).toEqual({ env: { LANG: 'en_US.UTF-8' } })
    expect(result).toMatchObject({ code: 0, cancelled: false, output: 'error: a.txt: retrying' })
  })
})

describe('runDueProfiles', () => {
  it('runs only due interval profiles, initializes bisync, records results and clears healthy auth alerts', async () => {
    const store = memoryConfig({
      profiles: [
        {
          id: 'sync-due',
          enabled: true,
          intervalMinutes: 60,
          mode: 'sync',
          source: 'drive:source',
          destination: '/backup',
          extraArgs: '',
        },
        {
          id: 'bisync-due',
          enabled: true,
          intervalMinutes: 60,
          mode: 'bisync',
          source: '/notes',
          destination: 'dropbox:notes',
          extraArgs: '--resilient',
        },
        { id: 'disabled', enabled: false, intervalMinutes: 5 },
        { id: 'manual', enabled: true, intervalMinutes: 0 },
        { id: 'recent', enabled: true, intervalMinutes: 60 },
      ],
      lastRun: { recent: { finishedAt: '2026-07-15T11:30:00.000Z', ok: true } },
      bisyncReady: {},
      authAlerts: {
        drive: { message: 'old', detectedAt: '2026-01-01T00:00:00.000Z' },
        dropbox: { message: 'old', detectedAt: '2026-01-01T00:00:00.000Z' },
      },
    })
    const calls: TestProfile[] = []
    const runProfile = vi.fn(async (profile: TestProfile) => {
      calls.push(structuredClone(profile))
      return {
        code: 0,
        cancelled: false,
        output: `${profile.id} ok`,
        finishedAt: '2026-07-15T12:00:01.000Z',
      }
    })

    const ran = await runDueProfiles({
      readConfig: store.readConfig,
      writeConfig: store.writeConfig,
      runProfile,
      now: () => FIXED_NOW,
    })

    expect(ran).toBe(true)
    expect(runProfile).toHaveBeenCalledTimes(2)
    expect(calls.map((profile) => profile.id)).toEqual(['sync-due', 'bisync-due'])
    expect(calls[1].extraArgs.split(' ')).toContain('--resync')
    expect(store.current().lastRun['sync-due']).toMatchObject({ ok: true, code: 0 })
    expect(store.current().lastRun['bisync-due']).toMatchObject({ ok: true, code: 0 })
    expect(store.current().bisyncReady['bisync-due']).toBe(true)
    expect(store.current().authAlerts).toEqual({})
  })

  it('automatically retries a previously initialized bisync with --resync when listings are missing', async () => {
    const store = memoryConfig({
      profiles: [
        {
          id: 'bisync',
          enabled: true,
          intervalMinutes: 5,
          mode: 'bisync',
          source: '/notes',
          destination: 'drive:notes',
          extraArgs: '--resilient',
        },
      ],
      lastRun: {},
      bisyncReady: { bisync: true },
      authAlerts: {},
    })
    const calls: TestProfile[] = []
    const runProfile = vi.fn(async (profile: TestProfile) => {
      calls.push(structuredClone(profile))
      if (calls.length === 1) throw new Error('cannot find prior Path1 or Path2 listings')
      return { code: 0, output: 'recovered', finishedAt: '2026-07-15T12:00:02.000Z' }
    })

    await runDueProfiles({
      readConfig: store.readConfig,
      writeConfig: store.writeConfig,
      runProfile,
      now: () => FIXED_NOW,
    })

    expect(runProfile).toHaveBeenCalledTimes(2)
    expect(calls[0].extraArgs).not.toContain('--resync')
    expect(calls[1].extraArgs.split(' ')).toContain('--resync')
    expect(store.current().lastRun.bisync).toMatchObject({ ok: true, output: 'recovered' })
  })

  it('records failures and raises a re-authorization alert for every affected remote', async () => {
    const store = memoryConfig({
      profiles: [
        {
          id: 'auth-failure',
          enabled: true,
          intervalMinutes: 5,
          mode: 'sync',
          source: 'gdrive:source',
          destination: 'archive:backup',
          extraArgs: '',
        },
      ],
      lastRun: {},
      bisyncReady: {},
      authAlerts: {},
    })
    const message = 'Starting transfer\noauth2: cannot fetch token: 401 Unauthorized\nGiving up'

    await runDueProfiles({
      readConfig: store.readConfig,
      writeConfig: store.writeConfig,
      runProfile: async () => {
        throw new Error(message)
      },
      now: () => FIXED_NOW,
    })

    expect(store.current().lastRun['auth-failure']).toEqual({
      ok: false,
      finishedAt: '2026-07-15T12:00:00.000Z',
      output: message,
    })
    expect(store.current().authAlerts).toEqual({
      gdrive: {
        message: 'oauth2: cannot fetch token: 401 Unauthorized',
        detectedAt: '2026-07-15T12:00:00.000Z',
      },
      archive: {
        message: 'oauth2: cannot fetch token: 401 Unauthorized',
        detectedAt: '2026-07-15T12:00:00.000Z',
      },
    })
  })
})
