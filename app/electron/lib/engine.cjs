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
};
