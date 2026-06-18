import { describe, it, expect } from 'vitest'
import {
  OPTION_FLAGS,
  buildConnString,
  clientLabel,
  formatSize,
  hasFlag,
  remoteOf,
  setFlag,
  tokenize,
} from '../src/lib/rclone'

describe('tokenize', () => {
  it('honors double-quoted segments', () => {
    expect(tokenize('--foo "a b" --bar')).toEqual(['--foo', '"a b"', '--bar'])
  })
})

describe('flag toggling', () => {
  it('detects a present flag', () => {
    expect(hasFlag('--checksum --bwlimit 8M', '--checksum')).toBe(true)
    expect(hasFlag('--dry-run', '--checksum')).toBe(false)
  })
  it('adds a flag without duplicating', () => {
    expect(setFlag('', '--checksum', true)).toBe('--checksum')
    expect(setFlag('--dry-run', '--checksum', true)).toBe('--dry-run --checksum')
    expect(setFlag('--checksum', '--checksum', true)).toBe('--checksum')
  })
  it('removes a two-token value flag', () => {
    expect(setFlag('--checksum --bwlimit 8M', '--bwlimit 8M', false)).toBe('--checksum')
  })
  it('maps option ids to flags', () => {
    expect(OPTION_FLAGS.bwlimit).toBe('--bwlimit 8M')
    expect(OPTION_FLAGS.dryrun).toBe('--dry-run')
  })
})

describe('buildConnString', () => {
  it('builds a basic connection string', () => {
    expect(buildConnString('s3', { provider: 'AWS', access_key_id: 'AKIA' })).toBe(
      ':s3,provider=AWS,access_key_id=AKIA:',
    )
  })
  it('skips empty fields and quotes values with spaces', () => {
    expect(buildConnString('sftp', { host: 'a b', user: '', port: '22' })).toBe(':sftp,host="a b",port=22:')
  })
  it('returns a bare type when no fields', () => {
    expect(buildConnString('drive', {})).toBe(':drive:')
  })
})

describe('path helpers', () => {
  it('remoteOf finds the matching remote prefix', () => {
    expect(remoteOf('isdrive:Backups/x', ['isdrive:', 'arsiv:'])).toBe('isdrive:')
    expect(remoteOf('/local/path', ['isdrive:'])).toBe('')
  })
  it('clientLabel strips the trailing colon', () => {
    expect(clientLabel('isdrive:')).toBe('isdrive')
  })
  it('formatSize humanizes bytes', () => {
    expect(formatSize(-1)).toBe('')
    expect(formatSize(512)).toBe('512 B')
    expect(formatSize(2048)).toBe('2.0 KB')
  })
})
