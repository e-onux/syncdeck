const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {
  splitArgs,
  normalizeMode,
  supportsEmptyDirs,
  progressFromStats,
  fileEventFromLogEntry,
  parseStats,
} = require('./lib/engine.cjs');

const APP_ID = 'com.emironuk.syncdeck';
const APP_NAME = 'SyncDeck';
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

// Keep the dock / menu-bar / userData name consistent with the packaged build.
app.setName(APP_NAME);
const configPath = () => path.join(app.getPath('userData'), 'profiles.json');
const launchAgentPath = () => path.join(os.homedir(), 'Library', 'LaunchAgents', `${APP_ID}.plist`);

function defaultConfig() {
  return {
    launchAtLogin: false,
    profiles: [],
    lastRun: {},
    bisyncReady: {},
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
  const [remotesResult, clientsResult] = rclonePath
    ? await Promise.allSettled([listRemotes(rclonePath), dumpRemotes(rclonePath)])
    : [{ status: 'fulfilled', value: [] }, { status: 'fulfilled', value: [] }];

  return {
    ...(await readConfig()),
    rclonePath,
    configPath: configPath(),
    launchAgentPath: launchAgentPath(),
    platform: process.platform,
    remotes: remotesResult.status === 'fulfilled' ? remotesResult.value : [],
    clients: clientsResult.status === 'fulfilled' ? clientsResult.value : [],
  };
}

function findRclone() {
  const candidates = [
    process.env.RCLONE_PATH,
    path.join(process.resourcesPath || '', 'bin', process.platform, process.arch, process.platform === 'win32' ? 'rclone.exe' : 'rclone'),
    path.join(app.getAppPath(), 'bin', process.platform, process.arch, process.platform === 'win32' ? 'rclone.exe' : 'rclone'),
    '/opt/homebrew/bin/rclone',
    '/usr/local/bin/rclone',
    '/usr/bin/rclone',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync('/bin/test', ['-x', candidate]);
    if (result.status === 0) return candidate;
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

function transferDirection(profile) {
  const sourceRemote = looksRemotePath(profile.source);
  const destinationRemote = looksRemotePath(profile.destination);
  if (sourceRemote && !destinationRemote) return 'download';
  if (!sourceRemote && destinationRemote) return 'upload';
  return 'unknown';
}

// Live sync jobs keyed by profile id, so a run can be cancelled from the UI.
const runningJobs = new Map();

function killChild(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    // SIGINT is unreliable on Windows; kill the whole process tree.
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    // rclone handles SIGINT gracefully: it stops, prints a final summary, exits.
    child.kill('SIGINT');
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
      args: ['--run-startup-syncs'],
    });
    return;
  }

  if (!enabled) {
    await fs.rm(launchAgentPath(), { force: true });
    spawnSync('/bin/launchctl', ['bootout', `gui/${process.getuid()}`, launchAgentPath()]);
    return;
  }

  const programArguments = app.isPackaged
    ? [process.execPath, '--run-startup-syncs']
    : [process.execPath, app.getAppPath(), '--run-startup-syncs'];

  const argsXml = programArguments.map((arg) => `    <string>${plistEscape(arg)}</string>`).join('\n');
  const logPath = path.join(app.getPath('userData'), 'startup-sync.log');
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
    } catch (error) {
      config.lastRun[profile.id] = {
        ok: false,
        finishedAt: new Date().toISOString(),
        output: error.message,
      };
    }
  }

  await writeConfig(config);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
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
    emit({ running: false, pct: result.cancelled ? undefined : 100 });
    return appState();
  } catch (error) {
    emit({ running: false });
    throw error;
  } finally {
    runningJobs.delete(id);
  }
});

ipcMain.handle('sync:cancel', async (_event, id) => {
  const job = runningJobs.get(id);
  if (job && job.child) {
    job.cancelled = true;
    killChild(job.child);
  }
  return true;
});

ipcMain.handle('remote:list', async (_event, remotePath) => listRemoteDir(remotePath));

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
} else if (process.argv.includes('--run-startup-syncs')) {
  app.whenReady().then(async () => {
    await runStartupSyncs();
    app.quit();
  });
} else {
  app.whenReady().then(createWindow);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
