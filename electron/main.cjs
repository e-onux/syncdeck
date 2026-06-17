const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const APP_ID = 'com.emironuk.syncdeck';
const APP_NAME = 'SyncDeck';
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const configPath = () => path.join(app.getPath('userData'), 'profiles.json');
const launchAgentPath = () => path.join(os.homedir(), 'Library', 'LaunchAgents', `${APP_ID}.plist`);

function defaultConfig() {
  return {
    launchAtLogin: false,
    profiles: [],
    lastRun: {},
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
  return {
    ...(await readConfig()),
    rclonePath: findRclone(),
    configPath: configPath(),
    launchAgentPath: launchAgentPath(),
    platform: process.platform,
    remotes: await listRemotes(),
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
    mode: profile.mode === 'copy' ? 'copy' : 'sync',
    enabled: Boolean(profile.enabled),
    extraArgs: String(profile.extraArgs || '').trim(),
  };
}

function splitArgs(input) {
  if (!input) return [];
  return input.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, '')) || [];
}

async function runRcloneProfile(profile) {
  const rclone = findRclone();
  if (!rclone) {
    throw new Error('rclone bulunamadı. Homebrew ile `brew install rclone` kur veya RCLONE_PATH ayarla.');
  }
  if (!profile.source || !profile.destination) {
    throw new Error('Kaynak ve hedef klasör zorunlu.');
  }

  const command = profile.mode === 'copy' ? 'copy' : 'sync';
  const args = [
    command,
    profile.source,
    profile.destination,
    '--create-empty-src-dirs',
    '--stats-one-line',
    '--stats=5s',
    ...splitArgs(profile.extraArgs),
  ];

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
      const result = {
        code,
        output: output.trim() || 'rclone çıktı üretmeden tamamlandı.',
        finishedAt: new Date().toISOString(),
      };
      if (code === 0) resolve(result);
      else reject(new Error(result.output || `rclone ${code} koduyla çıktı.`));
    });
  });
}

async function listRemotes() {
  const rclone = findRclone();
  if (!rclone) return [];

  return new Promise((resolve) => {
    const child = spawn(rclone, ['listremotes']);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', () => resolve([]));
    child.on('close', () => {
      resolve(output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean));
    });
  });
}

function normalizeRemote(remote) {
  const name = String(remote.name || '').trim().replace(/[:\s]+/g, '-');
  const type = String(remote.type || '').trim();
  if (!name || !type) throw new Error('Remote adı ve tipi zorunlu.');
  return {
    name,
    type,
    clientId: String(remote.clientId || '').trim(),
    clientSecret: String(remote.clientSecret || '').trim(),
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
  if (!rclone) throw new Error('rclone bulunamadı.');
  const remote = normalizeRemote(remoteInput);
  const args = ['config', 'create', remote.name, remote.type];

  if (remote.clientId) args.push('client_id', remote.clientId);
  if (remote.clientSecret) args.push('client_secret', remote.clientSecret);
  for (const option of remote.options) {
    args.push(option.key, option.value);
  }
  args.push(...splitArgs(remote.extraArgs));

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
      else reject(new Error(output.trim() || `rclone config create ${code} koduyla çıktı.`));
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
      const result = await runRcloneProfile(profile);
      config.lastRun[profile.id] = { ok: true, ...result };
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

ipcMain.handle('sync:run', async (_event, id) => {
  const config = await readConfig();
  const profile = config.profiles.find((item) => item.id === id);
  if (!profile) throw new Error('Profil bulunamadı.');
  const result = await runRcloneProfile(profile);
  config.lastRun[id] = { ok: true, ...result };
  await writeConfig(config);
  return appState();
});

ipcMain.handle('launch:set', async (_event, enabled) => {
  await setLaunchAgent(Boolean(enabled));
  return appState();
});

ipcMain.handle('remote:create', async (_event, remote) => {
  await createRemote(remote);
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

if (process.argv.includes('--run-startup-syncs')) {
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
