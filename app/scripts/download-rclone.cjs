const fs = require('node:fs');
const fsp = require('node:fs/promises');
const https = require('node:https');
const path = require('node:path');
const AdmZip = require('adm-zip');

const root = path.resolve(__dirname, '..');
const downloadsDir = path.join(root, '.rclone-downloads');

// Pin to the version recorded in rclone.version (kept in sync by the rclone-watch
// workflow) for reproducible bundles; fall back to "current" when absent.
const pinnedVersion = (() => {
  try {
    return fs.readFileSync(path.join(root, 'rclone.version'), 'utf8').trim();
  } catch {
    return '';
  }
})();

const targets = [
  { platform: 'darwin', arch: 'x64', dist: 'osx-amd64', binary: 'rclone' },
  { platform: 'darwin', arch: 'arm64', dist: 'osx-arm64', binary: 'rclone' },
  { platform: 'linux', arch: 'x64', dist: 'linux-amd64', binary: 'rclone' },
  { platform: 'linux', arch: 'arm64', dist: 'linux-arm64', binary: 'rclone' },
  { platform: 'win32', arch: 'x64', dist: 'windows-amd64', binary: 'rclone.exe' },
  { platform: 'win32', arch: 'arm64', dist: 'windows-arm64', binary: 'rclone.exe' },
];

function selectedTargets() {
  const only = process.env.RCLONE_TARGETS;
  if (!only) return targets;
  const wanted = new Set(only.split(',').map((item) => item.trim()).filter(Boolean));
  return targets.filter((target) => wanted.has(`${target.platform}-${target.arch}`));
}

async function download(url, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.rmSync(destination, { force: true });
          download(response.headers.location, destination).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`${url} returned HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', reject);
  });
}

async function installTarget(target) {
  const file = pinnedVersion
    ? `rclone-v${pinnedVersion}-${target.dist}.zip`
    : `rclone-current-${target.dist}.zip`;
  const url = pinnedVersion
    ? `https://downloads.rclone.org/v${pinnedVersion}/${file}`
    : `https://downloads.rclone.org/${file}`;
  const archivePath = path.join(downloadsDir, file);
  const destinationDir = path.join(root, 'bin', target.platform, target.arch);
  const destination = path.join(destinationDir, target.binary);

  if (fs.existsSync(destination) && !process.env.RCLONE_FORCE_DOWNLOAD) {
    console.log(`rclone ${target.platform}/${target.arch} already exists`);
    return;
  }

  console.log(`Downloading ${url}`);
  await download(url, archivePath);

  const zip = new AdmZip(archivePath);
  const entry = zip
    .getEntries()
    .find((item) => item.entryName.endsWith(`/${target.binary}`) || item.entryName === target.binary);

  if (!entry) {
    throw new Error(`Could not find ${target.binary} in ${archivePath}`);
  }

  await fsp.mkdir(destinationDir, { recursive: true });
  await fsp.writeFile(destination, entry.getData());
  if (target.platform !== 'win32') await fsp.chmod(destination, 0o755);
  console.log(`Installed ${destination}`);
}

async function main() {
  const selected = selectedTargets();
  if (selected.length === 0) throw new Error('No rclone targets selected.');
  await fsp.mkdir(downloadsDir, { recursive: true });

  for (const target of selected) {
    await installTarget(target);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
