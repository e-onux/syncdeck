// Headless scheduler entry point for ELECTRON_RUN_AS_NODE=1.
//
// This module intentionally has no Electron dependency: launchd can execute the
// Electron binary as a plain Node runtime without registering an application in
// the Dock. Paths normally supplied by Electron are explicit CLI arguments.

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const {
  splitArgs,
  normalizeMode,
  supportsEmptyDirs,
  isProfileDue,
  detectAuthError,
  firstMeaningfulLine,
} = require('./lib/engine.cjs');

const RCLONE_MISSING_MESSAGE =
  'Senkron motoru bulunamadı. SyncDeck’i yeniden kur veya motor dahil olacak şekilde tekrar derle.';

function defaultConfig() {
  return {
    launchAtLogin: false,
    profiles: [],
    lastRun: {},
    bisyncReady: {},
    authAlerts: {},
    dismissedAdvisories: [],
  };
}

function parseCliArgs(argv = []) {
  const names = new Map([
    ['--user-data', 'userData'],
    ['--app-path', 'appPath'],
    ['--resources-path', 'resourcesPath'],
  ]);
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const raw = String(argv[index]);
    const equalsAt = raw.indexOf('=');
    const flag = equalsAt >= 0 ? raw.slice(0, equalsAt) : raw;
    const key = names.get(flag);
    if (!key) throw new Error(`Bilinmeyen zamanlayıcı argümanı: ${flag}`);

    const value = equalsAt >= 0 ? raw.slice(equalsAt + 1) : argv[++index];
    if (value == null || String(value).trim() === '') {
      throw new Error(`${flag} için bir yol gerekli.`);
    }
    parsed[key] = String(value);
  }

  for (const [flag, key] of names) {
    if (!parsed[key]) throw new Error(`Gerekli zamanlayıcı argümanı eksik: ${flag}`);
  }

  return parsed;
}

function createConfigStore(userData, { fsApi = fs } = {}) {
  const configPath = path.join(userData, 'profiles.json');

  return {
    configPath,
    async readConfig() {
      try {
        const raw = await fsApi.readFile(configPath, 'utf8');
        return { ...defaultConfig(), ...JSON.parse(raw) };
      } catch {
        return defaultConfig();
      }
    },
    async writeConfig(config) {
      await fsApi.mkdir(path.dirname(configPath), { recursive: true });
      await fsApi.writeFile(configPath, JSON.stringify(config, null, 2));
    },
  };
}

function isUsable(file, accessSync = fsSync.accessSync) {
  if (!file) return false;
  try {
    accessSync(file, fsSync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findRclone({
  userData,
  appPath,
  resourcesPath,
  env = process.env,
  platform = process.platform,
  arch = process.arch,
  accessSync = fsSync.accessSync,
  spawnSyncImpl = spawnSync,
} = {}) {
  const executable = platform === 'win32' ? 'rclone.exe' : 'rclone';
  const candidates = [
    env.RCLONE_PATH,
    userData && path.join(userData, 'engine', executable),
    resourcesPath && path.join(resourcesPath, 'bin', platform, arch, executable),
    appPath && path.join(appPath, 'bin', platform, arch, executable),
    '/opt/homebrew/bin/rclone',
    '/usr/local/bin/rclone',
    '/usr/bin/rclone',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isUsable(candidate, accessSync)) return candidate;
  }

  const which = spawnSyncImpl('/usr/bin/env', ['which', 'rclone'], { encoding: 'utf8', env });
  return which && which.status === 0 ? String(which.stdout || '').trim() || null : null;
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
  return /Must run --resync to recover/i.test(message) || /cannot find prior Path1 or Path2 listings/i.test(message);
}

function looksRemotePath(value) {
  const text = String(value || '');
  return /^[^/\\\s][^:]*:/.test(text);
}

function remoteNamesFromProfile(profile) {
  return [profile && profile.source, profile && profile.destination]
    .filter(looksRemotePath)
    .map((value) => String(value).split(':')[0].trim())
    .filter(Boolean);
}

function buildRcloneArgs(profile) {
  const command = normalizeMode(profile.mode);
  return [
    command,
    profile.source,
    profile.destination,
    ...(supportsEmptyDirs(command) ? ['--create-empty-src-dirs'] : []),
    '--use-json-log',
    '--stats=1s',
    '-v',
    ...prepareExtraArgs(command, profile.extraArgs),
  ];
}

function runRcloneProfile(profile, { rclonePath, spawnImpl = spawn, env = process.env } = {}) {
  if (!rclonePath) throw new Error(RCLONE_MISSING_MESSAGE);
  if (!profile.source || !profile.destination) throw new Error('Kaynak ve hedef klasör zorunlu.');

  const args = buildRcloneArgs(profile);
  return new Promise((resolve, reject) => {
    const child = spawnImpl(rclonePath, args, { env });
    const logLines = [];
    let pending = '';
    let settled = false;

    const pushLog = (text) => {
      logLines.push(text);
      if (logLines.length > 400) logLines.splice(0, logLines.length - 400);
    };

    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let entry;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        pushLog(trimmed);
        return;
      }
      if (entry.stats) return;
      if (entry.msg) {
        const level = entry.level && entry.level !== 'info' ? `${entry.level}: ` : '';
        const where = entry.object ? `${entry.object}: ` : '';
        pushLog(`${level}${where}${entry.msg}`.trim());
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
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (pending.trim()) handleLine(pending);
      const body = logLines.join('\n').trim();
      const result = {
        code,
        cancelled: false,
        output: body || 'Motor çıktı üretmeden tamamlandı.',
        finishedAt: new Date().toISOString(),
      };
      if (code === 0) resolve(result);
      else reject(new Error(body || `Motor ${code} koduyla çıktı.`));
    });
  });
}

function nowValue(now) {
  return typeof now === 'function' ? now() : now;
}

function nowIso(now) {
  return new Date(nowValue(now)).toISOString();
}

async function reconcileAuthAlert(profile, { ok, output }, { readConfig, writeConfig, now = Date.now }) {
  const names = remoteNamesFromProfile(profile);
  if (!names.length) return;

  if (ok) {
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
    return;
  }

  if (!detectAuthError(output)) return;
  const config = await readConfig();
  config.authAlerts = config.authAlerts || {};
  const detectedAt = nowIso(now);
  const message = firstMeaningfulLine(output);
  for (const name of names) config.authAlerts[name] = { message, detectedAt };
  await writeConfig(config);
}

async function runDueProfiles({ readConfig, writeConfig, runProfile, now = Date.now } = {}) {
  if (typeof readConfig !== 'function' || typeof writeConfig !== 'function' || typeof runProfile !== 'function') {
    throw new Error('Zamanlayıcı bağımlılıkları eksik.');
  }

  const snapshot = await readConfig();
  const dueAt = nowValue(now);
  const due = snapshot.profiles.filter((profile) => isProfileDue(profile, snapshot.lastRun[profile.id], dueAt));
  let ran = false;

  for (const profile of due) {
    ran = true;
    let record;
    let bisyncOk = false;
    try {
      const needsResync = profile.mode === 'bisync' && !(snapshot.bisyncReady && snapshot.bisyncReady[profile.id]);
      const firstProfile = needsResync ? withExtraArg(profile, '--resync') : profile;
      let result;
      try {
        result = await runProfile(firstProfile);
      } catch (error) {
        if (profile.mode !== 'bisync' || needsResync || !needsBisyncResync(error)) throw error;
        result = await runProfile(withExtraArg(profile, '--resync'));
      }
      record = { ok: result.code === 0, ...result };
      bisyncOk = profile.mode === 'bisync' && result.code === 0;
    } catch (error) {
      record = { ok: false, finishedAt: nowIso(now), output: error.message };
    }

    const fresh = await readConfig();
    fresh.lastRun[profile.id] = record;
    if (bisyncOk) fresh.bisyncReady = { ...(fresh.bisyncReady || {}), [profile.id]: true };
    await writeConfig(fresh);
    await reconcileAuthAlert(profile, { ok: record.ok, output: record.output }, { readConfig, writeConfig, now });
  }

  return ran;
}

async function runCli(
  argv = process.argv.slice(2),
  {
    env = process.env,
    platform = process.platform,
    arch = process.arch,
    fsApi = fs,
    accessSync = fsSync.accessSync,
    spawnImpl = spawn,
    spawnSyncImpl = spawnSync,
    now = Date.now,
  } = {},
) {
  const paths = parseCliArgs(argv);
  const { readConfig, writeConfig } = createConfigStore(paths.userData, { fsApi });
  const rclonePath = findRclone({ ...paths, env, platform, arch, accessSync, spawnSyncImpl });

  return runDueProfiles({
    readConfig,
    writeConfig,
    runProfile: (profile) => runRcloneProfile(profile, { rclonePath, spawnImpl, env }),
    now,
  });
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(`[SyncDeck scheduler] ${error && error.message ? error.message : error}`);
    process.exitCode = 1;
  });
}

module.exports = {
  RCLONE_MISSING_MESSAGE,
  defaultConfig,
  parseCliArgs,
  createConfigStore,
  isUsable,
  findRclone,
  prepareExtraArgs,
  withExtraArg,
  needsBisyncResync,
  looksRemotePath,
  remoteNamesFromProfile,
  buildRcloneArgs,
  runRcloneProfile,
  reconcileAuthAlert,
  runDueProfiles,
  runCli,
};
