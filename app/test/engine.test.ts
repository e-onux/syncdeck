import { describe, it, expect } from 'vitest'
import {
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
  detectAuthError,
  firstMeaningfulLine,
  parseVersion,
  compareVersions,
  matchAdvisories,
  ENGINE_SMOKE_CHECKS,
  missingNeedles,
  assertSafeMcpArgs,
  parseRemoteTarget,
  redactConfigDump,
} from '../electron/lib/engine.cjs'

describe('splitArgs', () => {
  it('splits and unquotes', () => {
    expect(splitArgs('--bwlimit 8M --header "X: y"')).toEqual(['--bwlimit', '8M', '--header', 'X: y'])
  })
  it('returns [] for empty input', () => {
    expect(splitArgs('')).toEqual([])
  })
})

describe('mode helpers', () => {
  it('normalizeMode keeps known modes, clamps the rest to sync', () => {
    expect(normalizeMode('move')).toBe('move')
    expect(normalizeMode('bisync')).toBe('bisync')
    expect(normalizeMode('bogus')).toBe('sync')
    expect(normalizeMode(undefined)).toBe('sync')
  })
  it('supportsEmptyDirs only for sync/copy/move', () => {
    expect(supportsEmptyDirs('sync')).toBe(true)
    expect(supportsEmptyDirs('copy')).toBe(true)
    expect(supportsEmptyDirs('move')).toBe(true)
    expect(supportsEmptyDirs('bisync')).toBe(false)
    expect(supportsEmptyDirs('check')).toBe(false)
  })
})

describe('humanizers', () => {
  it('humanBytes', () => {
    expect(humanBytes(0)).toBe('0 B')
    expect(humanBytes(512)).toBe('512 B')
    expect(humanBytes(1024)).toBe('1.00 KiB')
    expect(humanBytes(1536)).toBe('1.50 KiB')
    expect(humanBytes(1048576)).toBe('1.00 MiB')
    expect(humanBytes(-5)).toBe('0 B')
  })
  it('humanRate', () => {
    expect(humanRate(0)).toBe('')
    expect(humanRate(1048576)).toBe('1.00 MiB/s')
  })
  it('humanEta', () => {
    expect(humanEta(null)).toBe('')
    expect(humanEta(42)).toBe('00:42')
    expect(humanEta(90)).toBe('01:30')
    expect(humanEta(3661)).toBe('1h01m')
  })
})

describe('progressFromStats', () => {
  it('maps rclone json stats to the progress payload', () => {
    const p = progressFromStats({
      bytes: 1200000,
      totalBytes: 1200000,
      transfers: 3,
      totalTransfers: 3,
      speed: 0,
      eta: null,
      errors: 0,
    })
    expect(p).toMatchObject({ pct: 100, files: 3, totalFiles: 3, errors: 0 })
    expect(p.transferred).toBe('1.14 MiB')
  })
  it('computes a partial percentage', () => {
    expect(progressFromStats({ bytes: 500, totalBytes: 1000 }).pct).toBe(50)
  })
  it('returns null for non-objects', () => {
    expect(progressFromStats(null)).toBeNull()
  })
  it('maps active rclone transfers to file bar events', () => {
    const p = progressFromStats(
      {
        bytes: 512,
        totalBytes: 1024,
        transferring: [{ name: 'keepass.kdbx', bytes: 512, size: 1024 }],
      },
      'upload',
    )
    expect(p.transferEvents).toEqual([
      { id: 'upload:keepass.kdbx', name: 'keepass.kdbx', direction: 'upload', pct: 50, status: 'active' },
    ])
  })
})

describe('fileEventFromLogEntry', () => {
  it('creates a done event from copied object log entries', () => {
    expect(fileEventFromLogEntry({ msg: 'Copied (new)', object: 'keepass.kdbx' }, 'download')).toEqual({
      id: 'download:keepass.kdbx',
      name: 'keepass.kdbx',
      direction: 'download',
      pct: 100,
      status: 'done',
    })
  })
  it('ignores non-file log entries', () => {
    expect(fileEventFromLogEntry({ msg: 'Starting sync' }, 'upload')).toBeNull()
  })
})

describe('parseStats (one-line fallback)', () => {
  it('parses a one-line stats string', () => {
    const s = parseStats('Transferred:   308.45 MiB / 482.18 MiB, 64%, 7.60 MiB/s, ETA 22s')
    expect(s).toMatchObject({ pct: 64 })
    expect(s.transferred).toContain('308.45')
  })
  it('returns null on a non-matching line', () => {
    expect(parseStats('hello world')).toBeNull()
  })
})

describe('detectAuthError', () => {
  it('matches common expired/revoked token signatures', () => {
    expect(detectAuthError('oauth2: cannot fetch token: 401 Unauthorized')).toBe(true)
    expect(detectAuthError('Failed to copy: invalid_grant')).toBe(true)
    expect(detectAuthError('token has been expired or revoked')).toBe(true)
    expect(detectAuthError("couldn't fetch token - maybe it has expired?")).toBe(true)
    expect(detectAuthError('AADSTS700082: The refresh token has expired')).toBe(true)
    expect(detectAuthError('Error 401: Unauthorized')).toBe(true)
  })
  it('sees through ANSI colour codes', () => {
    expect(detectAuthError('[31minvalid_grant[0m')).toBe(true)
  })
  it('does not flag ordinary failures', () => {
    expect(detectAuthError('directory not found')).toBe(false)
    expect(detectAuthError('Transferred: 10 MiB / 10 MiB, 100%')).toBe(false)
    expect(detectAuthError('')).toBe(false)
    expect(detectAuthError(null)).toBe(false)
  })
})

describe('firstMeaningfulLine', () => {
  it('prefers the line that matched an auth pattern', () => {
    const blob = 'Starting transfer\n2026/06/25 ERROR: oauth2: cannot fetch token: 401\nGiving up'
    expect(firstMeaningfulLine(blob)).toContain('oauth2: cannot fetch token')
  })
  it('falls back to the last non-empty line', () => {
    expect(firstMeaningfulLine('one\ntwo\n\n')).toBe('two')
  })
  it('returns empty string for blank input', () => {
    expect(firstMeaningfulLine('')).toBe('')
  })
})

describe('version helpers', () => {
  it('parseVersion extracts maj/min/patch', () => {
    expect(parseVersion('rclone v1.74.3')).toEqual([1, 74, 3])
    expect(parseVersion('v1.74')).toEqual([1, 74, 0])
    expect(parseVersion('nope')).toBeNull()
  })
  it('compareVersions orders correctly', () => {
    expect(compareVersions('1.74.3', '1.74.3')).toBe(0)
    expect(compareVersions('1.74.2', '1.74.3')).toBe(-1)
    expect(compareVersions('1.75.0', '1.74.9')).toBe(1)
    expect(compareVersions('rclone v1.74.0', '1.74.3')).toBe(-1)
  })
})

describe('matchAdvisories', () => {
  const onedrive = {
    id: 'onedrive-2026-06',
    severity: 'warning',
    providers: ['onedrive'],
    minRcloneVersion: '1.74.3',
    message: { tr: 'OneDrive güncelle', en: 'Update OneDrive' },
  }
  it('shows a provider+version advisory for an older engine', () => {
    const out = matchAdvisories({
      advisories: [onedrive],
      rcloneVersion: '1.73.0',
      providers: ['onedrive', 's3'],
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('onedrive-2026-06')
  })
  it('hides it once the engine is new enough', () => {
    expect(matchAdvisories({ advisories: [onedrive], rcloneVersion: '1.74.3', providers: ['onedrive'] })).toHaveLength(0)
  })
  it('hides it when the provider is not configured', () => {
    expect(matchAdvisories({ advisories: [onedrive], rcloneVersion: '1.0.0', providers: ['s3'] })).toHaveLength(0)
  })
  it('hides version-gated advisories when the version is unknown', () => {
    expect(matchAdvisories({ advisories: [onedrive], rcloneVersion: null, providers: ['onedrive'] })).toHaveLength(0)
  })
  it('respects dismissed ids', () => {
    expect(
      matchAdvisories({ advisories: [onedrive], rcloneVersion: '1.0.0', providers: ['onedrive'], dismissed: ['onedrive-2026-06'] }),
    ).toHaveLength(0)
  })
  it('shows a global notice with no provider/version filter', () => {
    const notice = { id: 'welcome', severity: 'info', message: { en: 'hi' } }
    expect(matchAdvisories({ advisories: [notice], rcloneVersion: '1.74.3', providers: [] })).toHaveLength(1)
  })
})

describe('engine smoke-test helpers', () => {
  it('missingNeedles reports absent flags', () => {
    const help = 'Usage: rclone sync ...\n  --create-empty-src-dirs\n  --use-json-log\n'
    expect(missingNeedles(help, ['--create-empty-src-dirs', '--use-json-log'])).toEqual([])
    expect(missingNeedles(help, ['--use-json-log', '--gone-flag'])).toEqual(['--gone-flag'])
    expect(missingNeedles('', ['--x'])).toEqual(['--x'])
  })
  it('every smoke check declares args and needles', () => {
    expect(ENGINE_SMOKE_CHECKS.length).toBeGreaterThan(0)
    for (const check of ENGINE_SMOKE_CHECKS) {
      expect(Array.isArray(check.args)).toBe(true)
      expect(check.args[0]).toBeTruthy()
      expect(Array.isArray(check.needles)).toBe(true)
    }
  })
})

describe('MCP policy layer', () => {
  it('assertSafeMcpArgs rejects dangerous flags', () => {
    expect(assertSafeMcpArgs(['--checksum', '--bwlimit', '8M'])).toEqual(['--checksum', '--bwlimit', '8M'])
    expect(() => assertSafeMcpArgs(['--config=/etc/evil.conf'])).toThrow()
    expect(() => assertSafeMcpArgs(['--drive-impersonate', 'ceo@x.com'])).toThrow()
    expect(() => assertSafeMcpArgs(['--rc'])).toThrow()
    expect(() => assertSafeMcpArgs([42 as unknown as string])).toThrow()
  })
  it('parseRemoteTarget validates remote, allowlist and traversal', () => {
    expect(parseRemoteTarget('gdrive:Backups/2026', ['gdrive'])).toEqual({
      remote: 'gdrive',
      sub: 'Backups/2026',
      path: 'gdrive:Backups/2026',
    })
    expect(() => parseRemoteTarget('gdrive:../etc', ['gdrive'])).toThrow()
    expect(() => parseRemoteTarget('secret:stuff', ['gdrive'])).toThrow()
    expect(() => parseRemoteTarget('-X bad', ['gdrive'])).toThrow()
    expect(() => parseRemoteTarget('no-colon-path', ['gdrive'])).toThrow()
    // no allowlist configured → any well-formed remote passes
    expect(parseRemoteTarget('any:dir').remote).toBe('any')
  })
  it('redactConfigDump masks secrets but keeps type', () => {
    const red = redactConfigDump({
      gdrive: { type: 'drive', token: 'SECRET', client_secret: 'S2', region: 'eu' },
    })
    expect(red.gdrive).toEqual({ type: 'drive', token: '***', client_secret: '***', region: 'eu' })
  })
})

describe('isProfileDue (scheduler)', () => {
  const now = Date.parse('2026-06-19T12:00:00Z')
  it('skips disabled or non-interval profiles', () => {
    expect(isProfileDue({ enabled: false, intervalMinutes: 60 }, null, now)).toBe(false)
    expect(isProfileDue({ enabled: true, intervalMinutes: 0 }, null, now)).toBe(false)
  })
  it('runs an enabled interval profile that never ran', () => {
    expect(isProfileDue({ enabled: true, intervalMinutes: 60 }, null, now)).toBe(true)
  })
  it('respects the elapsed interval', () => {
    const recent = { finishedAt: '2026-06-19T11:30:00Z' } // 30 min ago
    const old = { finishedAt: '2026-06-19T10:30:00Z' } // 90 min ago
    expect(isProfileDue({ enabled: true, intervalMinutes: 60 }, recent, now)).toBe(false)
    expect(isProfileDue({ enabled: true, intervalMinutes: 60 }, old, now)).toBe(true)
  })
})
