// Pure rclone-argument / path helpers shared by the UI and the unit tests.

export type OptionId = 'checksum' | 'dryrun' | 'bwlimit'

export const OPTION_FLAGS: Record<OptionId, string> = {
  checksum: '--checksum',
  dryrun: '--dry-run',
  bwlimit: '--bwlimit 8M',
}

export function tokenize(input: string): string[] {
  return input.match(/(?:[^\s"]+|"[^"]*")+/g) || []
}

export function hasFlag(extra: string, flag: string): boolean {
  return tokenize(extra).includes(flag.split(' ')[0])
}

export function setFlag(extra: string, flag: string, on: boolean): string {
  const tokens = tokenize(extra)
  const parts = flag.split(' ')
  const name = parts[0]
  const idx = tokens.indexOf(name)
  if (on) {
    if (idx === -1) tokens.push(...parts)
  } else if (idx !== -1) {
    tokens.splice(idx, parts.length > 1 ? 2 : 1)
  }
  return tokens.join(' ')
}

// rclone connection string for a one-off reachability test before saving.
export function buildConnString(type: string, fields: Record<string, string>): string {
  const parts = Object.entries(fields)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => {
      const needsQuote = /[\s,:"']/.test(v)
      return `${k}=${needsQuote ? `"${v.replace(/"/g, '""')}"` : v}`
    })
  return `:${type}${parts.length ? `,${parts.join(',')}` : ''}:`
}

export function remoteOf(destination: string, remotes: string[]): string {
  return remotes.find((r) => destination.startsWith(r)) || ''
}

// An rclone remote path looks like "name:" or "name:path" — not a local
// "/Users/…" path nor a Windows "C:\" drive (colon followed by a slash).
export function looksRemote(path: string): boolean {
  return /^[A-Za-z0-9][\w .+-]*:(?![\\/])/.test(path)
}

// Which side (source/destination) is the cloud endpoint, given an empty value
// defaults to local for the source and cloud for the destination.
export function isCloudSide(value: string, isSource: boolean): boolean {
  return value ? looksRemote(value) : !isSource
}

export function clientLabel(name: string): string {
  return name.replace(/:$/, '')
}

export function formatSize(bytes: number): string {
  if (bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}
