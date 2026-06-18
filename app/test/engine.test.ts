import { describe, it, expect } from 'vitest'
import {
  splitArgs,
  normalizeMode,
  supportsEmptyDirs,
  humanBytes,
  humanRate,
  humanEta,
  progressFromStats,
  parseStats,
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
