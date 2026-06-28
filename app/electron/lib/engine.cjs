// Pure, dependency-free engine helpers shared by main.cjs and the unit tests.
// Keeping these out of main.cjs (which pulls in electron) makes them testable
// under Node/Vitest without an Electron runtime.

const SYNC_MODES = ['sync', 'copy', 'move', 'bisync', 'check'];

// Split an extra-args string into argv, honoring double-quoted segments.
function splitArgs(input) {
  if (!input) return [];
  return input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) || [];
}

function normalizeMode(mode) {
  return SYNC_MODES.includes(mode) ? mode : 'sync';
}

// `--create-empty-src-dirs` is only valid for the file-moving commands.
function supportsEmptyDirs(command) {
  return command === 'sync' || command === 'copy' || command === 'move';
}

// ---- humanizers (match rclone's own formatting so the UI reads naturally) ----
function humanBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let value = n / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

function humanRate(bytesPerSec) {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '';
  return `${humanBytes(bytesPerSec)}/s`;
}

function humanEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.round(seconds);
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h${String(m).padStart(2, '0')}m`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Turn a parsed `--use-json-log` stats object into the live progress payload the
// renderer status bar consumes (bytes, %, speed, ETA, and file counts).
function progressFromStats(stats, direction = 'unknown') {
  if (!stats || typeof stats !== 'object') return null;
  const bytes = Number(stats.bytes) || 0;
  const totalBytes = Number(stats.totalBytes) || 0;
  const transferEvents = [];
  const activeTransfers = Array.isArray(stats.transferring) ? stats.transferring : [];
  for (const item of activeTransfers) {
    const name = String(item.name || item.Name || item.path || item.Path || '').trim();
    if (!name) continue;
    const size = Number(item.size ?? item.Size ?? item.totalBytes ?? 0) || 0;
    const itemBytes = Number(item.bytes ?? item.Bytes ?? 0) || 0;
    const pct =
      Number.isFinite(Number(item.percentage))
        ? Math.max(0, Math.min(100, Math.round(Number(item.percentage))))
        : size > 0
          ? Math.max(0, Math.min(100, Math.round((itemBytes / size) * 100)))
          : 0;
    transferEvents.push({
      id: `${direction}:${name}`,
      name,
      direction,
      pct,
      status: 'active',
    });
  }
  const pct = totalBytes > 0 ? Math.min(100, Math.round((bytes / totalBytes) * 100)) : 0;
  return {
    transferred: humanBytes(bytes),
    total: totalBytes > 0 ? humanBytes(totalBytes) : '',
    pct,
    speed: humanRate(Number(stats.speed)),
    eta: stats.eta != null ? humanEta(Number(stats.eta)) : '',
    files: Number(stats.transfers) || 0,
    totalFiles: Number(stats.totalTransfers) || 0,
    errors: Number(stats.errors) || 0,
    transferEvents,
  };
}

function fileEventFromLogEntry(entry, direction = 'unknown') {
  if (!entry || typeof entry !== 'object') return null;
  const name = String(entry.object || entry.name || '').trim();
  const msg = String(entry.msg || '');
  if (!name) return null;

  if (/Copied|Moved|Renamed|Transferred|Server Side Cop/i.test(msg)) {
    return { id: `${direction}:${name}`, name, direction, pct: 100, status: 'done' };
  }
  if (/Deleted|Removing/i.test(msg)) {
    return { id: `delete:${name}`, name, direction: 'unknown', pct: 100, status: 'deleted' };
  }
  if (/error|failed/i.test(msg) || entry.level === 'error') {
    return { id: `error:${name}`, name, direction, pct: 100, status: 'error' };
  }
  return null;
}

// Fallback parser for a textual rclone `--stats-one-line` progress line.
function parseStats(line) {
  const m = line.match(
    /Transferred:\s*([\d.]+\s*\w+)\s*\/\s*([\d.]+\s*\w+),\s*(\d+)%(?:,\s*([\d.]+\s*\w+\/s))?(?:,\s*ETA\s*(\S+))?/i,
  );
  if (!m) return null;
  return {
    transferred: m[1].replace(/\s+/g, ' ').trim(),
    total: m[2].replace(/\s+/g, ' ').trim(),
    pct: Number(m[3]),
    speed: m[4] ? m[4].replace(/\s+/g, ' ').trim() : '',
    eta: m[5] || '',
  };
}

// Signatures of an expired / revoked OAuth token or other auth failure in
// rclone output. When any of these appear the remote needs the user to run the
// web auth flow again (`rclone config reconnect`). Kept broad on purpose: a
// false positive only surfaces a "re-authorize" hint, never blocks anything.
const AUTH_ERROR_PATTERNS = [
  /oauth2:\s*cannot fetch token/i,
  /invalid_grant/i,
  /token (?:has )?(?:been )?expired(?: or revoked)?/i,
  /(?:could not|couldn't|failed to|unable to) (?:refresh|fetch|get) (?:the )?token/i,
  /refresh token .*(?:expired|revoked|invalid)/i,
  /\b401\b[^\n]*\bunauthorized\b/i,
  /\b403\b[^\n]*\b(?:access denied|forbidden|insufficient)/i,
  /InvalidAuthenticationToken/i,
  /\bAADSTS\d+/i, // Microsoft Entra/AzureAD auth error codes
  /authentication (?:failed|required|error)/i,
  /not authenticated/i,
  /credentials? (?:are )?(?:invalid|expired|missing)/i,
];

// Strip rclone's ANSI colour codes so pattern matching and display are stable.
function stripAnsi(text) {
  return String(text == null ? '' : text).replace(/\[[0-9;]*m/g, '');
}

// True when rclone output looks like an auth/token expiry the user must fix by
// re-authorizing the remote in the browser.
function detectAuthError(text) {
  const clean = stripAnsi(text);
  if (!clean) return false;
  return AUTH_ERROR_PATTERNS.some((re) => re.test(clean));
}

// The first non-empty, human-meaningful line of an error blob — used as the
// short message shown next to the "re-authorize" prompt.
function firstMeaningfulLine(text) {
  const lines = stripAnsi(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // Prefer the line that actually matched an auth pattern, else the last line
  // (rclone prints the fatal cause last), else the first.
  const matched = lines.find((line) => AUTH_ERROR_PATTERNS.some((re) => re.test(line)));
  return matched || lines[lines.length - 1] || lines[0] || '';
}

// ---- MCP policy layer (shared so the GUI and MCP paths can't drift) ----

// Flags an MCP/agent caller must never be able to inject — they can redirect
// config, impersonate, exfiltrate via remote control, or read from arbitrary
// list files. Reused by the MCP server when sanitizing a profile's extraArgs.
const MCP_DENIED_FLAGS = [
  '--config',
  '--cache-dir',
  '--temp-dir',
  '--rc',
  '--rc-addr',
  '--rc-user',
  '--rc-pass',
  '--rc-no-auth',
  '--drive-impersonate',
  '--command',
  '--filter-from',
  '--files-from',
  '--include-from',
  '--exclude-from',
  '--log-file',
  '--dump',
];

// Throw if any arg is a denied flag (matches "--flag" and "--flag=value"); else
// return the args unchanged. Non-strings are rejected outright.
function assertSafeMcpArgs(args) {
  for (const arg of args || []) {
    if (typeof arg !== 'string') throw new Error('Geçersiz argüman türü.');
    const flag = arg.split('=')[0];
    if (MCP_DENIED_FLAGS.includes(flag)) throw new Error(`İzin verilmeyen bayrak: ${flag}`);
  }
  return args || [];
}

// Validate an agent-supplied remote target ("remote:sub/dir"): the remote must be
// on the allowlist (when one is configured), with no parent-dir traversal and no
// leading dash (which would smuggle a flag). Returns the parsed pieces.
function parseRemoteTarget(input, allowedRemotes = null) {
  const text = String(input == null ? '' : input).trim();
  if (!text || text.startsWith('-')) throw new Error('Geçersiz hedef.');
  const match = text.match(/^([A-Za-z0-9][\w .+-]*):(.*)$/);
  if (!match) throw new Error('Hedef "remote:yol" biçiminde olmalı.');
  const remote = match[1];
  const sub = match[2];
  if (/(^|\/)\.\.(\/|$)/.test(sub)) throw new Error('Üst dizine çıkış (..) yasak.');
  if (Array.isArray(allowedRemotes) && allowedRemotes.length && !allowedRemotes.includes(remote)) {
    throw new Error(`Remote izinli değil: ${remote}`);
  }
  return { remote, sub, path: `${remote}:${sub}` };
}

// Config-dump keys whose values are secrets and must never reach a tool result.
const SECRET_CONFIG_KEYS = [
  'token',
  'client_secret',
  'pass',
  'password',
  'secret_access_key',
  'key',
  'api_key',
  'sa_credentials',
  'service_account_credentials',
];

// Redact secret values from an `rclone config dump` object.
function redactConfigDump(dump) {
  const out = {};
  for (const [name, value] of Object.entries(dump || {})) {
    const safe = {};
    for (const [key, val] of Object.entries(value || {})) {
      safe[key] = SECRET_CONFIG_KEYS.includes(String(key).toLowerCase()) ? '***' : val;
    }
    out[name] = safe;
  }
  return out;
}

// rclone commands + flags SyncDeck depends on. A freshly self-updated engine
// must still expose all of these (verified via each command's --help) before we
// promote it — the compatibility smoke test the user asked for.
const ENGINE_SMOKE_CHECKS = [
  // Global flags live under `rclone help flags`, not the per-command help.
  { args: ['help', 'flags'], needles: ['--use-json-log', '--stats', '--auto-confirm'] },
  { args: ['sync', '--help'], needles: ['--create-empty-src-dirs'] },
  { args: ['bisync', '--help'], needles: ['--resync'] },
  { args: ['config', '--help'], needles: ['create', 'delete', 'dump', 'reconnect', 'providers'] },
  { args: ['lsjson', '--help'], needles: ['--max-depth'] },
  { args: ['about', '--help'], needles: ['--json'] },
];

// Which required needles are absent from a command's --help output.
function missingNeedles(text, needles = []) {
  const haystack = String(text == null ? '' : text);
  return (needles || []).filter((needle) => !haystack.includes(needle));
}

// Parse a version like "rclone v1.74.3", "v1.74.3" or "1.74" into [1,74,3].
// Returns null when no version-looking token is present.
function parseVersion(text) {
  const m = String(text == null ? '' : text).match(/v?(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
}

// Compare two versions (string or [maj,min,patch]). -1 if a<b, 0 equal, 1 a>b.
// Unparseable inputs are treated as 0.0.0.
function compareVersions(a, b) {
  const pa = Array.isArray(a) ? a : parseVersion(a) || [0, 0, 0];
  const pb = Array.isArray(b) ? b : parseVersion(b) || [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

// Decide which remote advisories apply right now. An advisory is shown when:
//  - it has an id and isn't dismissed, and
//  - its provider filter (if any) intersects the configured providers, and
//  - its version gate (minRcloneVersion / minAppVersion) triggers — i.e. the
//    installed version is OLDER. With no version fields it's a plain notice.
// Version-gated advisories are hidden when the relevant version is unknown, so a
// missing engine never produces a false "please update" alarm.
function matchAdvisories({ advisories, rcloneVersion, appVersion, providers = [], dismissed = [] } = {}) {
  if (!Array.isArray(advisories)) return [];
  const dismissedSet = new Set((dismissed || []).map(String));
  const providerSet = new Set((providers || []).map((p) => String(p).toLowerCase()));
  return advisories.filter((adv) => {
    if (!adv || !adv.id || dismissedSet.has(String(adv.id))) return false;

    const advProviders = Array.isArray(adv.providers) ? adv.providers.map((p) => String(p).toLowerCase()) : [];
    if (advProviders.length && !advProviders.some((p) => providerSet.has(p))) return false;

    let versionGated = false;
    let versionTriggers = false;
    if (adv.minRcloneVersion) {
      versionGated = true;
      if (rcloneVersion && compareVersions(rcloneVersion, adv.minRcloneVersion) < 0) versionTriggers = true;
    }
    if (adv.minAppVersion) {
      versionGated = true;
      if (appVersion && compareVersions(appVersion, adv.minAppVersion) < 0) versionTriggers = true;
    }
    if (versionGated && !versionTriggers) return false;

    return true;
  });
}

// Whether a profile is due to run under the background scheduler: it must be
// enabled with a positive interval, and either never run or last run at least
// `intervalMinutes` ago.
function isProfileDue(profile, lastRun, now = Date.now()) {
  if (!profile || !profile.enabled) return false;
  const interval = Number(profile.intervalMinutes) || 0;
  if (interval <= 0) return false;
  if (!lastRun || !lastRun.finishedAt) return true;
  const last = Date.parse(lastRun.finishedAt);
  if (!Number.isFinite(last)) return true;
  return now - last >= interval * 60000;
}

module.exports = {
  SYNC_MODES,
  splitArgs,
  normalizeMode,
  supportsEmptyDirs,
  humanBytes,
  humanRate,
  humanEta,
  progressFromStats,
  fileEventFromLogEntry,
  parseStats,
  isProfileDue,
  AUTH_ERROR_PATTERNS,
  stripAnsi,
  detectAuthError,
  firstMeaningfulLine,
  parseVersion,
  compareVersions,
  matchAdvisories,
  ENGINE_SMOKE_CHECKS,
  missingNeedles,
  MCP_DENIED_FLAGS,
  assertSafeMcpArgs,
  parseRemoteTarget,
  SECRET_CONFIG_KEYS,
  redactConfigDump,
};
