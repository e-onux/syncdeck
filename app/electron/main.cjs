const { app, BrowserWindow, Tray, Menu, nativeImage, dialog, ipcMain, shell } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  splitArgs,
  normalizeMode,
  supportsEmptyDirs,
  humanBytes,
  progressFromStats,
  fileEventFromLogEntry,
  parseStats,
  isProfileDue,
  detectAuthError,
  firstMeaningfulLine,
  parseVersion,
  compareVersions,
  matchAdvisories,
  ENGINE_SMOKE_CHECKS,
  missingNeedles,
} = require('./lib/engine.cjs');

const APP_ID = 'com.emironuk.syncdeck';
const APP_NAME = 'SyncDeck';
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
// macOS LaunchAgent cadence for the background scheduler daemon (every 5 min);
// the in-app ticker checks more often (every minute) while the window is open.
const SCHEDULER_TICK_SECONDS = 300;
// Remote advisory feed: lets us surface provider-specific "please update" alerts
// (e.g. an OneDrive API change) without shipping a new app build. Override with
// SYNCDECK_ADVISORY_URL for staging. Refreshed in the background, cached to disk.
const ADVISORY_URL =
  process.env.SYNCDECK_ADVISORY_URL || 'https://raw.githubusercontent.com/e-onux/syncdeck/main/advisories.json';
const ADVISORY_TTL_MS = 6 * 60 * 60 * 1000; // re-fetch at most every 6 hours

// Keep the dock / menu-bar / userData name consistent with the packaged build.
app.setName(APP_NAME);

let mainWindow = null;
let tray = null;
let schedulerTimer = null;
let schedulerTickRunning = false;
let advisoryCache = null; // last-known advisories array
let advisoryCacheAt = 0;
let rcloneVersionString = null; // installed engine version, e.g. "1.74.3"
const configPath = () => path.join(app.getPath('userData'), 'profiles.json');
const advisoryCachePath = () => path.join(app.getPath('userData'), 'advisories-cache.json');
const launchAgentPath = () => path.join(os.homedir(), 'Library', 'LaunchAgents', `${APP_ID}.plist`);

function defaultConfig() {
  return {
    launchAtLogin: false,
    profiles: [],
    lastRun: {},
    bisyncReady: {},
    // remoteName -> { message, detectedAt } when a run failed with an auth error.
    authAlerts: {},
    // advisory ids the user has dismissed (kill-switch banner).
    dismissedAdvisories: [],
  };
}

async function readConfig() {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

async function writeConfig(config) {
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2));
}

async function appState() {
  const rclonePath = findRclone();
  const [remotesResult, clientsResult, backendTypesResult] = rclonePath
    ? await Promise.allSettled([listRemotes(rclonePath), dumpRemotes(rclonePath), listBackendTypes(rclonePath)])
    : [{ status: 'fulfilled', value: [] }, { status: 'fulfilled', value: [] }, { status: 'fulfilled', value: [] }];

  const config = await readConfig();
  const clients = clientsResult.status === 'fulfilled' ? clientsResult.value : [];
  const rcloneVersion = rclonePath ? await captureRcloneVersion() : null;
  const advisories = matchAdvisories({
    advisories: advisoryCache || [],
    rcloneVersion,
    appVersion: app.getVersion(),
    providers: clients.map((client) => client.type).filter(Boolean),
    dismissed: config.dismissedAdvisories || [],
  });

  return {
    ...config,
    rclonePath,
    configPath: configPath(),
    launchAgentPath: launchAgentPath(),
    platform: process.platform,
    remotes: remotesResult.status === 'fulfilled' ? remotesResult.value : [],
    clients,
    backendTypes: backendTypesResult.status === 'fulfilled' ? backendTypesResult.value : [],
    advisories,
    rcloneVersion,
    appVersion: app.getVersion(),
  };
}

const RCLONE_EXE = process.platform === 'win32' ? 'rclone.exe' : 'rclone';
// Writable directory for the self-updated engine. Kept OUTSIDE the signed app
// bundle so replacing the binary never invalidates the bundle's code signature.
const managedEngineDir = () => path.join(app.getPath('userData'), 'engine');
function managedRclonePath() {
  try {
    return path.join(managedEngineDir(), RCLONE_EXE);
  } catch {
    return null;
  }
}

// Cross-platform "is this an executable we can run?" — checks the exec bit on
// posix and existence on Windows (where X_OK is not meaningful).
function isUsable(file) {
  if (!file) return false;
  try {
    fsSync.accessSync(file, fsSync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findRclone() {
  const candidates = [
    process.env.RCLONE_PATH,
    // A self-updated engine (if present and compatible) wins over the bundled one.
    managedRclonePath(),
    path.join(process.resourcesPath || '', 'bin', process.platform, process.arch, RCLONE_EXE),
    path.join(app.getAppPath(), 'bin', process.platform, process.arch, RCLONE_EXE),
    '/opt/homebrew/bin/rclone',
    '/usr/local/bin/rclone',
    '/usr/bin/rclone',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isUsable(candidate)) return candidate;
  }

  const which = spawnSync('/usr/bin/env', ['which', 'rclone'], { encoding: 'utf8' });
  return which.status === 0 ? which.stdout.trim() : null;
}

function normalizeProfile(profile) {
  return {
    id: profile.id || String(Date.now()),
    name: String(profile.name || 'Yeni Senkron').trim(),
    source: String(profile.source || '').trim(),
    destination: String(profile.destination || '').trim(),
    mode: normalizeMode(profile.mode),
    enabled: Boolean(profile.enabled),
    extraArgs: String(profile.extraArgs || '').trim(),
    intervalMinutes: Math.max(0, Math.floor(Number(profile.intervalMinutes) || 0)),
  };
}

function hasArg(args, name) {
  return args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));
}

function hasCompareChecksum(args) {
  const compareIndex = args.indexOf('--compare');
  return (
    args.includes('--checksum') ||
    args.includes('--compare=checksum') ||
    (compareIndex >= 0 && args[compareIndex + 1] === 'checksum')
  );
}

function prepareExtraArgs(command, extraArgs) {
  const args = splitArgs(extraArgs);

  if (command === 'bisync' && hasArg(args, '--ignore-listing-checksum') && !hasCompareChecksum(args)) {
    return args.filter((arg) => arg !== '--ignore-listing-checksum');
  }

  return args;
}

function withExtraArg(profile, arg) {
  const args = splitArgs(profile.extraArgs);
  if (!hasArg(args, arg)) args.push(arg);
  return { ...profile, extraArgs: args.join(' ') };
}

function needsBisyncResync(error) {
  const message = String(error && error.message ? error.message : error).replace(/\u001b\[[0-9;]*m/g, '');
  return (
    /Must run --resync to recover/i.test(message) ||
    /cannot find prior Path1 or Path2 listings/i.test(message)
  );
}

function looksRemotePath(value) {
  const text = String(value || '');
  return /^[^/\\\s][^:]*:/.test(text);
}

// The remote (client) names referenced by a profile's source/destination, e.g.
// "gdrive:Backups" -> "gdrive". Used to attribute auth failures to a client.
function remoteNamesFromProfile(profile) {
  return [profile && profile.source, profile && profile.destination]
    .filter(looksRemotePath)
    .map((value) => String(value).split(':')[0].trim())
    .filter(Boolean);
}

// Persist a "needs re-authorization" alert for every remote a failing profile
// touches. Re-reads config so a concurrent run isn't clobbered.
async function flagAuthAlert(profile, message) {
  const names = remoteNamesFromProfile(profile);
  if (!names.length) return;
  const config = await readConfig();
  config.authAlerts = config.authAlerts || {};
  const detectedAt = new Date().toISOString();
  const summary = firstMeaningfulLine(message);
  for (const name of names) {
    config.authAlerts[name] = { message: summary, detectedAt };
  }
  await writeConfig(config);
}

// Drop auth alerts for the remotes a profile touches (after a successful run or
// a successful reconnect — auth is healthy again).
async function clearAuthAlertsForProfile(profile) {
  const names = remoteNamesFromProfile(profile);
  if (!names.length) return;
  const config = await readConfig();
  if (!config.authAlerts) return;
  let changed = false;
  for (const name of names) {
    if (config.authAlerts[name]) {
      delete config.authAlerts[name];
      changed = true;
    }
  }
  if (changed) await writeConfig(config);
}

// Inspect a run result/error and record or clear the auth alert accordingly.
async function reconcileAuthAlert(profile, { ok, output }) {
  if (ok) {
    await clearAuthAlertsForProfile(profile);
  } else if (detectAuthError(output)) {
    await flagAuthAlert(profile, output);
  }
}

function transferDirection(profile) {
  const sourceRemote = looksRemotePath(profile.source);
  const destinationRemote = looksRemotePath(profile.destination);
  if (sourceRemote && !destinationRemote) return 'download';
  if (!sourceRemote && destinationRemote) return 'upload';
  return 'unknown';
}

// Live sync jobs keyed by profile id, so a run can be cancelled from the UI.
const runningJobs = new Map();

function killChild(child, force = false) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    // SIGINT is unreliable on Windows; kill the whole process tree.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    // Graceful by default: rclone handles SIGINT by stopping, printing a final
    // summary and exiting. `force` (SIGKILL) is the "zorla durdur" escape hatch.
    child.kill(force ? 'SIGKILL' : 'SIGINT');
  }
}

async function runRcloneProfile(profile, onProgress, jobControl) {
  const rclone = findRclone();
  if (!rclone) {
    throw new Error('Senkron motoru bulunamadı. SyncDeck’i yeniden kur veya motor dahil olacak şekilde tekrar derle.');
  }
  if (!profile.source || !profile.destination) {
    throw new Error('Kaynak ve hedef klasör zorunlu.');
  }

  const command = normalizeMode(profile.mode);
  const extraArgs = prepareExtraArgs(command, profile.extraArgs);
  const direction = transferDirection(profile);
  const args = [
    command,
    profile.source,
    profile.destination,
    ...(supportsEmptyDirs(command) ? ['--create-empty-src-dirs'] : []),
    '--use-json-log',
    '--stats=1s',
    '-v',
    ...extraArgs,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(rclone, args, { env: process.env });
    if (jobControl) jobControl.child = child;

    const logLines = [];
    let pending = '';

    const pushLog = (text) => {
      logLines.push(text);
      // Keep the live log bounded — the renderer shows the tail.
      if (logLines.length > 400) logLines.splice(0, logLines.length - 400);
    };

    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let entry = null;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        // Non-JSON line (e.g. a stray banner) — keep it verbatim.
        pushLog(trimmed);
        const fallback = parseStats(trimmed);
        if (fallback && typeof onProgress === 'function') onProgress(fallback);
        return;
      }
      if (entry.stats) {
        const progress = progressFromStats(entry.stats, direction);
        if (progress && typeof onProgress === 'function') onProgress(progress);
        return; // stats spam stays out of the readable log
      }
      if (entry.msg) {
        const level = entry.level && entry.level !== 'info' ? `${entry.level}: ` : '';
        const where = entry.object ? `${entry.object}: ` : '';
        pushLog(`${level}${where}${entry.msg}`.trim());
        const fileEvent = fileEventFromLogEntry(entry, direction);
        if (fileEvent && typeof onProgress === 'function') onProgress({ transferEvents: [fileEvent] });
      }
    };

    const consume = (chunk) => {
      pending += chunk.toString();
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() || '';
      for (const line of lines) handleLine(line);
    };

    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.on('error', reject);
    child.on('close', (code) => {
      if (pending.trim()) handleLine(pending);
      const cancelled = Boolean(jobControl && jobControl.cancelled);
      const body = logLines.join('\n').trim();
      const result = {
        code,
        cancelled,
        output: cancelled
          ? `${body}\n■ Çalışma durduruldu.`.trim()
          : body || 'Motor çıktı üretmeden tamamlandı.',
        finishedAt: new Date().toISOString(),
      };
      if (code === 0 || cancelled) resolve(result);
      else reject(new Error(body || `Motor ${code} koduyla çıktı.`));
    });
  });
}

function captureRclone(args, { timeoutMs = 5000 } = {}) {
  const rclone = findRclone();
  if (!rclone) return [];

  return new Promise((resolve) => {
    const child = spawn(rclone, args);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(output);
    };
    const timer = setTimeout(() => {
      killChild(child);
      finish();
    }, timeoutMs);

    child.on('error', finish);
    child.on('close', finish);
  });
}

// Installed engine version (cached), parsed from `rclone version`'s first line.
async function captureRcloneVersion() {
  if (rcloneVersionString) return rcloneVersionString;
  if (!findRclone()) return null;
  const out = await captureRclone(['version'], { timeoutMs: 5000 });
  const parsed = parseVersion(String(out || '').split(/\r?\n/)[0]);
  rcloneVersionString = parsed ? parsed.join('.') : null;
  return rcloneVersionString;
}

// Pull the advisory feed (cached in-memory + on disk). Network failures fall
// back to the last cached copy, so this never blocks startup or surfaces errors.
async function refreshAdvisories({ force = false } = {}) {
  if (!force && advisoryCache && Date.now() - advisoryCacheAt < ADVISORY_TTL_MS) return advisoryCache;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(ADVISORY_URL, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const advisories = Array.isArray(data) ? data : Array.isArray(data && data.advisories) ? data.advisories : [];
    advisoryCache = advisories;
    advisoryCacheAt = Date.now();
    fs.writeFile(advisoryCachePath(), JSON.stringify({ at: advisoryCacheAt, advisories }, null, 2)).catch(() => {});
    return advisories;
  } catch {
    if (advisoryCache) return advisoryCache;
    try {
      const parsed = JSON.parse(await fs.readFile(advisoryCachePath(), 'utf8'));
      advisoryCache = Array.isArray(parsed.advisories) ? parsed.advisories : [];
      advisoryCacheAt = Number(parsed.at) || 0;
    } catch {
      advisoryCache = [];
    }
    return advisoryCache;
  }
}

// Run an arbitrary executable, resolving combined stdout+stderr on exit 0 and
// rejecting (with the last error line) otherwise. Used for engine self-update.
function execCapture(file, args, { timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { env: process.env });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    let done = false;
    const settle = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      killChild(child);
      settle(reject, new Error('Zaman aşımı.'));
    }, timeoutMs);
    child.on('error', (error) => settle(reject, error));
    child.on('close', (code) => {
      if (code === 0) settle(resolve, `${out}${err}`);
      else settle(reject, new Error((err || out || `kod ${code}`).trim().split(/\r?\n/).pop()));
    });
  });
}

// Latest stable rclone version string ("1.74.3") from the official endpoint.
async function fetchLatestRcloneVersion() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://downloads.rclone.org/version.txt', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseVersion(await res.text());
    return parsed ? parsed.join('.') : null;
  } catch {
    return null;
  }
}

// Compatibility gate: a freshly downloaded engine must run AND still expose every
// command/flag SyncDeck depends on (see ENGINE_SMOKE_CHECKS) before we trust it.
// This is the "uyumluluk kontrolü" — verifying via real --help parameter checks.
async function smokeTestRclone(binPath) {
  try {
    const versionOut = await execCapture(binPath, ['version'], { timeoutMs: 15000 });
    const parsed = parseVersion(String(versionOut).split(/\r?\n/)[0]);
    if (!parsed) return { ok: false, reason: 'sürüm okunamadı' };
    const version = parsed.join('.');
    for (const check of ENGINE_SMOKE_CHECKS) {
      let help = '';
      try {
        help = await execCapture(binPath, check.args, { timeoutMs: 15000 });
      } catch (error) {
        return { ok: false, version, reason: `${check.args[0]} çalıştırılamadı: ${error.message}` };
      }
      const missing = missingNeedles(help, check.needles);
      if (missing.length) return { ok: false, version, reason: `${check.args[0]} eksik: ${missing.join(', ')}` };
    }
    return { ok: true, version };
  } catch (error) {
    return { ok: false, reason: error.message || 'çalıştırılamadı' };
  }
}

// Download the latest (or a specific) rclone into the managed engine dir using
// rclone's own verified selfupdate, then ad-hoc sign it (macOS), smoke-test it,
// and only promote it to the active engine if it passes. Never touches the
// bundled binary, so a failed/incompatible update always rolls back cleanly.
async function updateRcloneEngine({ version } = {}) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Senkron motoru bulunamadı.');

  await fs.mkdir(managedEngineDir(), { recursive: true });
  const stagedPath = path.join(managedEngineDir(), process.platform === 'win32' ? 'rclone-staged.exe' : 'rclone-staged');
  await fs.rm(stagedPath, { force: true });

  // 1) rclone downloads + verifies (hashsum + cryptographic signature) itself.
  const args = ['selfupdate', '--output', stagedPath, '--stable'];
  if (version) args.push('--version', String(version).startsWith('v') ? String(version) : `v${version}`);
  await execCapture(rclone, args, { timeoutMs: 180000 });
  if (!fsSync.existsSync(stagedPath)) throw new Error('İndirilen motor bulunamadı.');

  // 2) Make the downloaded binary runnable. On macOS it lands outside the signed
  // bundle, so ad-hoc sign it and strip the quarantine flag (matches after-pack).
  if (process.platform !== 'win32') await fs.chmod(stagedPath, 0o755);
  if (process.platform === 'darwin') {
    spawnSync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', stagedPath]);
    spawnSync('/usr/bin/codesign', ['--force', '--sign', '-', stagedPath]);
  }

  // 3) Compatibility smoke test BEFORE promoting.
  const smoke = await smokeTestRclone(stagedPath);
  if (!smoke.ok) {
    await fs.rm(stagedPath, { force: true });
    throw new Error(`Yeni sürüm (rclone) uyumluluk testini geçemedi: ${smoke.reason}`);
  }

  // 4) Promote atomically (rename within the same dir), then re-detect version.
  const target = managedRclonePath();
  await fs.rm(target, { force: true });
  await fs.rename(stagedPath, target);
  rcloneVersionString = null;
  return { ok: true, version: smoke.version, path: target };
}

// Is a newer rclone available? Compares the installed engine to version.txt.
async function checkEngineUpdate() {
  const installed = await captureRcloneVersion();
  const latest = await fetchLatestRcloneVersion();
  return {
    installed,
    latest,
    updateAvailable: Boolean(installed && latest && compareVersions(installed, latest) < 0),
    managed: isUsable(managedRclonePath()),
  };
}

// Remove the self-updated engine and fall back to the bundled binary.
async function resetRcloneEngine() {
  await fs.rm(managedEngineDir(), { recursive: true, force: true });
  rcloneVersionString = null;
  return true;
}

async function listRemotes(rclonePath = findRclone()) {
  if (!rclonePath) return [];
  const output = await captureRclone(['listremotes']);
  return output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

// Detailed remotes (name + type) via `rclone config dump`.
async function dumpRemotes(rclonePath = findRclone()) {
  if (!rclonePath) return [];
  const output = await captureRclone(['config', 'dump']);
  try {
    const parsed = JSON.parse(output || '{}');
    return Object.entries(parsed).map(([name, value]) => ({
      name: `${name}:`,
      type: (value && value.type) || '',
    }));
  } catch {
    return [];
  }
}

// Supported backend catalogue from the bundled/selected rclone binary. This
// keeps the wizard aligned with the exact engine version shipped in SyncDeck.
async function listBackendTypes(rclonePath = findRclone()) {
  if (!rclonePath) return [];
  const output = await captureRclone(['config', 'providers'], { timeoutMs: 10000 });
  try {
    const parsed = JSON.parse(output || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((provider) => provider && provider.Name && !provider.Hide)
      .map((provider) => ({
        id: String(provider.Prefix || provider.Name),
        name: String(provider.Name),
        description: String(provider.Description || provider.Name),
        options: Array.isArray(provider.Options)
          ? provider.Options
              .filter((option) => option && option.Name && !option.Hide)
              .map((option) => ({
                name: String(option.Name),
                help: String(option.Help || ''),
                required: Boolean(option.Required),
                advanced: Boolean(option.Advanced),
                secret: Boolean(option.IsPassword || option.Sensitive),
                type: String(option.Type || 'string'),
                examples: Array.isArray(option.Examples)
                  ? option.Examples.map((example) => ({
                      value: String(example.Value || ''),
                      help: String(example.Help || ''),
                    }))
                  : [],
              }))
          : [],
      }))
      .sort((a, b) => a.description.localeCompare(b.description));
  } catch {
    return [];
  }
}

// List one remote folder via `rclone lsjson remote:path`.
async function listRemoteDir(remotePath) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Motor bulunamadı.');
  const target = String(remotePath || '').trim();
  if (!target) throw new Error('Geçersiz bulut yolu.');

  return new Promise((resolve, reject) => {
    const child = spawn(rclone, ['lsjson', target], { env: process.env });
    let output = '';
    let errOutput = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      errOutput += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(errOutput.trim() || `Liste alınamadı (kod ${code}).`));
        return;
      }
      try {
        const entries = JSON.parse(output || '[]');
        resolve(
          entries
            .map((entry) => ({ name: entry.Name, isDir: Boolean(entry.IsDir), size: entry.Size }))
            .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1)),
        );
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

async function mkdirRemoteDir(remotePath) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Motor bulunamadı.');
  const target = String(remotePath || '').trim();
  if (!target || !target.includes(':')) throw new Error('Geçersiz bulut yolu.');

  return new Promise((resolve, reject) => {
    const child = spawn(rclone, ['mkdir', target], { env: process.env });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(output.trim() || `Klasör oluşturulamadı (kod ${code}).`));
    });
  });
}

function normalizeRemote(remote) {
  const name = String(remote.name || '').trim().replace(/[:\s]+/g, '-');
  const type = String(remote.type || '').trim();
  if (!name || !type) throw new Error('İstemci adı ve türü zorunlu.');
  return {
    name,
    type,
    clientId: String(remote.clientId || '').trim(),
    clientSecret: String(remote.clientSecret || '').trim(),
    token: String(remote.token || '').trim(),
    options: Array.isArray(remote.options)
      ? remote.options
          .map((option) => ({
            key: String(option.key || '').trim(),
            value: String(option.value || '').trim(),
          }))
          .filter((option) => option.key && option.value)
      : [],
    extraArgs: String(remote.extraArgs || '').trim(),
  };
}

async function createRemote(remoteInput) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Senkron motoru bulunamadı.');
  const remote = normalizeRemote(remoteInput);
  const args = ['config', 'create', remote.name, remote.type];

  if (remote.clientId) args.push('client_id', remote.clientId);
  if (remote.clientSecret) args.push('client_secret', remote.clientSecret);
  for (const option of remote.options) {
    args.push(option.key, option.value);
  }
  // An OAuth token captured by the wizard — store it and skip the local browser flow.
  if (remote.token) args.push('token', remote.token, 'config_is_local', 'false');
  args.push(...splitArgs(remote.extraArgs));
  // Store any password-type fields obscured (rclone's expected format).
  args.push('--obscure', '--non-interactive');

  return new Promise((resolve, reject) => {
    const child = spawn(rclone, args, { env: process.env });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(output.trim() || `İstemci oluşturulamadı (kod ${code}).`));
    });
  });
}

// Run rclone's own OAuth helper: it opens the browser, runs a localhost callback,
// and prints the resulting token JSON between marker lines, which we capture.
async function authorizeRemote(payload) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Senkron motoru bulunamadı.');
  const type = String((payload && payload.type) || '').trim();
  if (!type) throw new Error('Geçersiz istemci türü.');
  const args = ['authorize', type];
  const clientId = String((payload && payload.clientId) || '').trim();
  const clientSecret = String((payload && payload.clientSecret) || '').trim();
  if (clientId) args.push(clientId);
  if (clientSecret) args.push(clientSecret);

  return new Promise((resolve, reject) => {
    const child = spawn(rclone, args, { env: process.env });
    runningJobs.set('__authorize__', { cancelled: false, child });
    let buffer = '';
    const collect = (chunk) => {
      buffer += chunk.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      runningJobs.delete('__authorize__');
      reject(error);
    });
    child.on('close', (code) => {
      runningJobs.delete('__authorize__');
      const match = buffer.match(/--->\s*([\s\S]*?)\s*<---/);
      const token = match ? match[1].trim() : '';
      if (token) resolve(token);
      else reject(new Error(buffer.trim() || `Yetkilendirme tamamlanamadı (kod ${code}).`));
    });
  });
}

// Reachability check. Accepts a saved remote name (`work:`) or an on-the-fly
// connection string (`:s3,access_key_id=…:`) so the wizard can test before save.
async function testRemote(target) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Senkron motoru bulunamadı.');
  let path = String(target || '').trim();
  if (!path) throw new Error('Geçersiz istemci.');
  if (!path.includes(':')) path = `${path}:`;

  return new Promise((resolve) => {
    const child = spawn(rclone, ['lsd', path, '--max-depth', '1', '--low-level-retries', '1'], { env: process.env });
    let errOutput = '';
    child.stderr.on('data', (chunk) => {
      errOutput += chunk.toString();
    });
    child.on('error', () => resolve({ ok: false, message: 'Motor çalıştırılamadı.' }));
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, message: errOutput.trim().split(/\r?\n/).pop() || `Bağlantı başarısız (kod ${code}).` });
    });
  });
}

async function deleteRemote(name) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Senkron motoru bulunamadı.');
  const clean = String(name || '').trim().replace(/:$/, '');
  if (!clean) throw new Error('Geçersiz istemci adı.');

  return new Promise((resolve, reject) => {
    const child = spawn(rclone, ['config', 'delete', clean], { env: process.env });
    let errOutput = '';
    child.stderr.on('data', (chunk) => {
      errOutput += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(errOutput.trim() || `İstemci silinemedi (kod ${code}).`));
    });
  });
}

// Re-run the OAuth web flow for an existing remote and refresh its stored token
// in place (`rclone config reconnect name:`). Unlike delete+recreate this keeps
// all other client settings. `--auto-confirm` answers rclone's "refresh the
// existing token?" prompt so it proceeds non-interactively to the browser step.
async function reconnectRemote(name) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Senkron motoru bulunamadı.');
  const clean = String(name || '').trim().replace(/:$/, '');
  if (!clean) throw new Error('Geçersiz istemci adı.');

  return new Promise((resolve, reject) => {
    const child = spawn(rclone, ['config', 'reconnect', `${clean}:`, '--auto-confirm'], { env: process.env });
    runningJobs.set('__reconnect__', { cancelled: false, child });
    let output = '';
    const collect = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      runningJobs.delete('__reconnect__');
      reject(error);
    });
    child.on('close', async (code) => {
      runningJobs.delete('__reconnect__');
      if (code === 0) {
        // Auth is healthy again — clear any pending alert for this remote.
        const config = await readConfig();
        if (config.authAlerts && config.authAlerts[clean]) {
          delete config.authAlerts[clean];
          await writeConfig(config);
        }
        resolve(output.trim());
      } else {
        reject(new Error(output.trim().split(/\r?\n/).pop() || `Yeniden yetkilendirme başarısız (kod ${code}).`));
      }
    });
  });
}

// Quota / free space for a remote (`rclone about`). Not all backends support it.
async function aboutRemote(name) {
  const rclone = findRclone();
  if (!rclone) throw new Error('Senkron motoru bulunamadı.');
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Geçersiz istemci.');
  const target = clean.endsWith(':') ? clean : `${clean}:`;

  return new Promise((resolve) => {
    const child = spawn(rclone, ['about', target, '--json'], { env: process.env });
    let output = '';
    let errOutput = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      errOutput += chunk.toString();
    });
    child.on('error', () => resolve({ supported: false }));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ supported: false, message: errOutput.trim().split(/\r?\n/).pop() || '' });
        return;
      }
      try {
        const info = JSON.parse(output || '{}');
        resolve({
          supported: true,
          total: info.total != null ? humanBytes(info.total) : '',
          used: info.used != null ? humanBytes(info.used) : '',
          free: info.free != null ? humanBytes(info.free) : '',
        });
      } catch {
        resolve({ supported: false });
      }
    });
  });
}

function plistEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function setLaunchAgent(enabled) {
  const config = await readConfig();
  config.launchAtLogin = enabled;
  await writeConfig(config);

  if (process.platform !== 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      args: ['--run-scheduled'],
    });
    return;
  }

  if (!enabled) {
    await fs.rm(launchAgentPath(), { force: true });
    spawnSync('/bin/launchctl', ['bootout', `gui/${process.getuid()}`, launchAgentPath()]);
    return;
  }

  const programArguments = app.isPackaged
    ? [process.execPath, '--run-scheduled']
    : [process.execPath, app.getAppPath(), '--run-scheduled'];

  const argsXml = programArguments.map((arg) => `    <string>${plistEscape(arg)}</string>`).join('\n');
  const logPath = path.join(app.getPath('userData'), 'scheduler.log');
  // Runs at login and then every SCHEDULER_TICK_SECONDS, even when the UI is
  // closed — the background "daemon". Each run executes only due profiles.
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${APP_ID}</string>
  <key>ProgramArguments</key>
  <array>
${argsXml}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${SCHEDULER_TICK_SECONDS}</integer>
  <key>StandardOutPath</key>
  <string>${plistEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${plistEscape(logPath)}</string>
</dict>
</plist>
`;
  await fs.mkdir(path.dirname(launchAgentPath()), { recursive: true });
  await fs.writeFile(launchAgentPath(), plist);
  spawnSync('/bin/launchctl', ['bootout', `gui/${process.getuid()}`, launchAgentPath()]);
  spawnSync('/bin/launchctl', ['bootstrap', `gui/${process.getuid()}`, launchAgentPath()]);
}

async function runStartupSyncs() {
  const config = await readConfig();
  const enabledProfiles = config.profiles.filter((profile) => profile.enabled);

  for (const profile of enabledProfiles) {
    try {
      const needsResync = profile.mode === 'bisync' && !(config.bisyncReady && config.bisyncReady[profile.id]);
      const runProfile = needsResync ? withExtraArg(profile, '--resync') : profile;
      let result;
      try {
        result = await runRcloneProfile(runProfile);
      } catch (error) {
        if (profile.mode !== 'bisync' || needsResync || !needsBisyncResync(error)) throw error;
        result = await runRcloneProfile(withExtraArg(profile, '--resync'));
      }
      config.lastRun[profile.id] = { ok: true, ...result };
      if (profile.mode === 'bisync') config.bisyncReady = { ...(config.bisyncReady || {}), [profile.id]: true };
      for (const name of remoteNamesFromProfile(profile)) {
        if (config.authAlerts && config.authAlerts[name]) delete config.authAlerts[name];
      }
    } catch (error) {
      config.lastRun[profile.id] = {
        ok: false,
        finishedAt: new Date().toISOString(),
        output: error.message,
      };
      if (detectAuthError(error.message)) {
        config.authAlerts = config.authAlerts || {};
        const detectedAt = new Date().toISOString();
        const summary = firstMeaningfulLine(error.message);
        for (const name of remoteNamesFromProfile(profile)) config.authAlerts[name] = { message: summary, detectedAt };
      }
    }
  }

  await writeConfig(config);
}

function emitToWindow(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send(channel, payload);
    } catch {
      /* window may have closed */
    }
  }
}

// Run every profile whose schedule is due right now. Config is re-read before
// each write so a concurrent manual run isn't clobbered. Optionally streams
// progress to the open window so background syncs still show in the status bar.
async function runDueProfiles({ emitProgress = false } = {}) {
  const snapshot = await readConfig();
  const now = Date.now();
  const due = snapshot.profiles.filter(
    (profile) => isProfileDue(profile, snapshot.lastRun[profile.id], now) && !runningJobs.has(profile.id),
  );
  let ran = false;

  for (const profile of due) {
    ran = true;
    const jobControl = { cancelled: false, child: null };
    runningJobs.set(profile.id, jobControl);
    if (emitProgress) emitToWindow('sync:progress', { id: profile.id, running: true, pct: 0 });
    let record;
    let bisyncOk = false;
    try {
      const needsResync = profile.mode === 'bisync' && !(snapshot.bisyncReady && snapshot.bisyncReady[profile.id]);
      const runProfile = needsResync ? withExtraArg(profile, '--resync') : profile;
      const onProgress = emitProgress
        ? (stats) => emitToWindow('sync:progress', { id: profile.id, running: true, ...stats })
        : undefined;
      let result;
      try {
        result = await runRcloneProfile(runProfile, onProgress, jobControl);
      } catch (error) {
        if (profile.mode !== 'bisync' || needsResync || !needsBisyncResync(error)) throw error;
        result = await runRcloneProfile(withExtraArg(profile, '--resync'), onProgress, jobControl);
      }
      record = { ok: result.code === 0, ...result };
      bisyncOk = profile.mode === 'bisync' && result.code === 0;
    } catch (error) {
      record = { ok: false, finishedAt: new Date().toISOString(), output: error.message };
    } finally {
      runningJobs.delete(profile.id);
      if (emitProgress) emitToWindow('sync:progress', { id: profile.id, running: false });
    }
    const fresh = await readConfig();
    fresh.lastRun[profile.id] = record;
    if (bisyncOk) fresh.bisyncReady = { ...(fresh.bisyncReady || {}), [profile.id]: true };
    await writeConfig(fresh);
    await reconcileAuthAlert(profile, { ok: record.ok, output: record.output });
  }

  return ran;
}

// Headless daemon entry point (--run-scheduled): run due profiles, then quit.
async function runScheduledSyncs() {
  return runDueProfiles({ emitProgress: false });
}

// In-app ticker: while the window is open, run due profiles and refresh the UI.
async function schedulerTick() {
  if (schedulerTickRunning) return;
  schedulerTickRunning = true;
  try {
    const ran = await runDueProfiles({ emitProgress: true });
    if (ran) emitToWindow('state:refresh');
  } catch {
    /* keep the ticker alive across transient errors */
  } finally {
    schedulerTickRunning = false;
  }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: APP_NAME,
    // Frameless: SyncDeck draws its own title bar + traffic-light controls so the
    // chrome matches the design across macOS/Windows/Linux.
    frame: false,
    backgroundColor: '#0b0f0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  // Closing hides to the tray instead of quitting (real quit sets app.isQuitting).
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (isDev) await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));

  // Background scheduler: while the window is open, check every minute for
  // due profiles (the macOS LaunchAgent covers the app-closed case).
  if (!schedulerTimer) schedulerTimer = setInterval(schedulerTick, 60000);

  // Pull the advisory feed shortly after launch; refresh the UI if it arrives.
  refreshAdvisories()
    .then(() => emitToWindow('state:refresh'))
    .catch(() => undefined);
}

function showMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function trayIconImage() {
  const candidates = [
    path.join(process.resourcesPath || '', 'icon.png'), // packaged (extraResources)
    path.join(__dirname, '..', 'build', 'icon.png'), // dev
  ];
  for (const file of candidates) {
    try {
      const img = nativeImage.createFromPath(file);
      if (!img.isEmpty()) return img.resize({ width: 18, height: 18 });
    } catch {
      /* try next */
    }
  }
  return nativeImage.createEmpty();
}

// Menu-bar / system-tray presence so closing the window keeps SyncDeck running
// (the background scheduler stays alive) and the user can reopen or quit it.
function createTray() {
  if (tray) return;
  tray = new Tray(trayIconImage());
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: APP_NAME, enabled: false },
      { type: 'separator' },
      { label: 'Göster', click: showMainWindow },
      {
        label: 'Çıkış',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', showMainWindow);
}

ipcMain.handle('app:get-state', async () => appState());

ipcMain.handle('dialog:choose-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('profile:save', async (_event, rawProfile) => {
  const profile = normalizeProfile(rawProfile);
  const config = await readConfig();
  const existingIndex = config.profiles.findIndex((item) => item.id === profile.id);
  if (existingIndex >= 0) config.profiles[existingIndex] = profile;
  else config.profiles.push(profile);
  await writeConfig(config);
  return appState();
});

ipcMain.handle('profile:delete', async (_event, id) => {
  const config = await readConfig();
  config.profiles = config.profiles.filter((profile) => profile.id !== id);
  delete config.lastRun[id];
  await writeConfig(config);
  return appState();
});

ipcMain.handle('sync:run', async (event, id) => {
  const config = await readConfig();
  const profile = config.profiles.find((item) => item.id === id);
  if (!profile) throw new Error('Profil bulunamadı.');
  if (runningJobs.has(id)) throw new Error('Bu profil zaten çalışıyor.');
  const emit = (payload) => {
    try {
      event.sender.send('sync:progress', { id, ...payload });
    } catch {
      /* window may have closed */
    }
  };
  const jobControl = { cancelled: false, child: null };
  runningJobs.set(id, jobControl);
  emit({ running: true, pct: 0 });
  // bisync needs a one-time --resync to establish its baseline on the first run.
  const needsResync = profile.mode === 'bisync' && !(config.bisyncReady && config.bisyncReady[id]);
  const runProfile = needsResync ? withExtraArg(profile, '--resync') : profile;
  try {
    let result;
    try {
      result = await runRcloneProfile(runProfile, (stats) => emit({ running: true, ...stats }), jobControl);
    } catch (error) {
      if (profile.mode !== 'bisync' || needsResync || !needsBisyncResync(error)) throw error;
      emit({ running: true, pct: 0 });
      result = await runRcloneProfile(withExtraArg(profile, '--resync'), (stats) => emit({ running: true, ...stats }), jobControl);
    }
    config.lastRun[id] = { ok: result.code === 0, ...result };
    if (profile.mode === 'bisync' && result.code === 0) {
      config.bisyncReady = { ...(config.bisyncReady || {}), [id]: true };
    }
    await writeConfig(config);
    if (!result.cancelled) await reconcileAuthAlert(profile, { ok: result.code === 0, output: result.output });
    emit({ running: false, pct: result.cancelled ? undefined : 100 });
    return appState();
  } catch (error) {
    emit({ running: false });
    await reconcileAuthAlert(profile, { ok: false, output: error.message });
    throw error;
  } finally {
    runningJobs.delete(id);
  }
});

ipcMain.handle('sync:cancel', async (_event, id, force = false) => {
  const job = runningJobs.get(id);
  if (job && job.child) {
    job.cancelled = true;
    killChild(job.child, Boolean(force));
  }
  return true;
});

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => {
  // close() runs the 'close' handler above, which hides to the tray.
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('remote:list', async (_event, remotePath) => listRemoteDir(remotePath));
ipcMain.handle('remote:mkdir', async (_event, remotePath) => mkdirRemoteDir(remotePath));

ipcMain.handle('open:external', async (_event, url) => {
  const target = String(url || '');
  if (/^https?:\/\//i.test(target)) await shell.openExternal(target);
});

ipcMain.handle('launch:set', async (_event, enabled) => {
  await setLaunchAgent(Boolean(enabled));
  return appState();
});

ipcMain.handle('remote:create', async (_event, remote) => {
  await createRemote(remote);
  return appState();
});

ipcMain.handle('remote:authorize', async (_event, payload) => authorizeRemote(payload || {}));

ipcMain.handle('remote:test', async (_event, target) => testRemote(target));

ipcMain.handle('remote:delete', async (_event, name) => {
  await deleteRemote(name);
  return appState();
});

ipcMain.handle('remote:about', async (_event, name) => aboutRemote(name));

ipcMain.handle('remote:reconnect', async (_event, name) => {
  await reconnectRemote(name);
  return appState();
});

ipcMain.handle('advisory:dismiss', async (_event, id) => {
  const config = await readConfig();
  const dismissed = new Set(config.dismissedAdvisories || []);
  dismissed.add(String(id));
  config.dismissedAdvisories = [...dismissed];
  await writeConfig(config);
  return appState();
});

ipcMain.handle('engine:check-update', async () => checkEngineUpdate());

ipcMain.handle('engine:update', async (_event, version) => {
  await updateRcloneEngine({ version: version || undefined });
  return appState();
});

ipcMain.handle('engine:reset', async () => {
  await resetRcloneEngine();
  return appState();
});

ipcMain.handle('about:open', async () => {
  dialog.showMessageBox({
    type: 'info',
    title: `About ${APP_NAME}`,
    message: APP_NAME,
    detail: `${APP_NAME} is a cross-platform graphical wrapper for rclone.\n\nrclone is an independent open-source project by the rclone maintainers. This app depends on rclone and gives full credit to the rclone project. Learn more at https://rclone.org/`,
    buttons: ['OK'],
  });
});

if (process.argv.includes('--self-test')) {
  // Headless diagnostic: resolve the engine and list remotes, print, quit.
  // Useful for confirming the bundled rclone is found ("engine not found" issues).
  app.whenReady().then(async () => {
    try {
      const state = await appState();
      process.stdout.write(
        `${JSON.stringify(
          {
            enginePath: state.rclonePath,
            platform: state.platform,
            remoteCount: (state.remotes || []).length,
            remotes: state.remotes,
            clients: state.clients,
          },
          null,
          2,
        )}\n`,
      );
    } catch (error) {
      process.stdout.write(`SELF-TEST ERROR: ${error.message}\n`);
    }
    app.quit();
  });
} else if (process.argv.includes('--run-scheduled')) {
  // Background daemon tick (LaunchAgent / login item): run due profiles, quit.
  app.whenReady().then(async () => {
    await runScheduledSyncs();
    app.quit();
  });
} else if (process.argv.includes('--run-startup-syncs')) {
  app.whenReady().then(async () => {
    await runStartupSyncs();
    app.quit();
  });
} else {
  app.isQuitting = false;
  app.whenReady().then(() => {
    createTray();
    createWindow();
  });
  app.on('activate', showMainWindow);
  // A real quit (Cmd+Q, app menu, tray "Çıkış") must bypass the hide-on-close.
  app.on('before-quit', () => {
    app.isQuitting = true;
  });
  // Closing the window only hides it (tray keeps SyncDeck + the scheduler alive),
  // so we intentionally do not quit on window-all-closed.
}
