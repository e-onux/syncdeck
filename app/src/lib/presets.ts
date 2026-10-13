// Well-known services on standard protocols (S3, WebDAV, SFTP, SMB) for the
// client wizard. The catalogue lives in sources/provider-presets.json and is
// shared with the iOS app; this module only reads it.
import catalog from '../../../sources/provider-presets.json'

export type Localized = string | Record<string, string>

export type PresetGroup = {
  id: string
  label: Localized
  tag?: Localized
}

export type Preset = {
  id: string
  name: Localized
  group: string
  backend: string
  icon?: string
  tag?: string
  /** Settings written to the remote but never shown, e.g. { provider: 'Wasabi' }. */
  set?: Record<string, string>
  fields: string[]
  required?: string[]
  prefill?: Record<string, string>
  hints?: Record<string, string>
}

export type PresetCatalog = { groups: PresetGroup[]; presets: Preset[] }

export const PRESETS = catalog as unknown as PresetCatalog

export function localized(value: Localized | undefined, language: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value[language] ?? value.en ?? Object.values(value)[0] ?? ''
}

/**
 * rclone's per-option provider filter: "" matches every provider, "A,B" only
 * those, "!A,B" every provider except those.
 */
export function matchesProvider(filter: string | undefined, provider: string | undefined): boolean {
  if (!filter || !provider) return true
  const negate = filter.startsWith('!')
  const list = (negate ? filter.slice(1) : filter).split(',').map((p) => p.trim())
  return list.includes(provider) !== negate
}

/**
 * The option a preset field refers to. Some backends (s3) define the same
 * option name several times with different provider filters and examples;
 * pick the one meant for the preset's provider.
 */
export function resolveOption<T extends { name: string; provider?: string; examples?: Array<{ provider?: string }> }>(
  options: T[],
  name: string,
  provider: string | undefined,
): T | undefined {
  const candidates = options.filter((option) => option.name === name)
  const option = candidates.find((o) => o.provider && matchesProvider(o.provider, provider))
    ?? candidates.find((o) => matchesProvider(o.provider, provider))
  if (!option?.examples) return option
  // Newer rclone keeps one option and filters each example instead.
  return { ...option, examples: option.examples.filter((e) => matchesProvider(e.provider, provider)) }
}

export function presetTag(preset: Preset, language: string): string {
  if (preset.tag) return preset.tag
  const group = PRESETS.groups.find((g) => g.id === preset.group)
  return localized(group?.tag, language)
}

export function searchPresets(query: string, language: string): Preset[] {
  const q = query.trim().toLowerCase()
  if (!q) return PRESETS.presets
  return PRESETS.presets.filter((preset) =>
    `${preset.id} ${localized(preset.name, language)} ${presetTag(preset, language)} ${preset.backend}`.toLowerCase().includes(q),
  )
}
