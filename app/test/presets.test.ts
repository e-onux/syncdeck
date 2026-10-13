import { describe, expect, it } from 'vitest'
import { PRESETS, localized, matchesProvider, presetTag, resolveOption, searchPresets } from '../src/lib/presets'

const LANGUAGES = ['en', 'tr', 'de', 'es', 'nl', 'zh', 'ja', 'ru', 'ar']

describe('provider presets catalogue', () => {
  it('has unique ids and known groups', () => {
    const ids = PRESETS.presets.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const groups = new Set(PRESETS.groups.map((g) => g.id))
    for (const preset of PRESETS.presets) expect(groups.has(preset.group), preset.id).toBe(true)
  })

  it('only marks shown fields as required and prefills shown fields', () => {
    for (const preset of PRESETS.presets) {
      expect(preset.fields.length, preset.id).toBeGreaterThan(0)
      for (const key of preset.required ?? []) expect(preset.fields, preset.id).toContain(key)
      for (const key of Object.keys(preset.prefill ?? {})) expect(preset.fields, preset.id).toContain(key)
      for (const key of Object.keys(preset.hints ?? {})) expect(preset.fields, preset.id).toContain(key)
    }
  })

  it('translates every label into all app languages', () => {
    const labels = [
      ...PRESETS.groups.flatMap((g) => [g.label, g.tag]),
      ...PRESETS.presets.map((p) => p.name),
    ].filter((v) => v && typeof v !== 'string') as Record<string, string>[]
    for (const map of labels) for (const lang of LANGUAGES) expect(map[lang], JSON.stringify(map)).toBeTruthy()
  })

  it('lists well-known S3 and WebDAV services next to the generic ones', () => {
    const ids = PRESETS.presets.map((p) => p.id)
    for (const id of ['aws', 'cloudflare-r2', 'wasabi', 'minio', 's3-other', 'nextcloud', 'owncloud', 'webdav-other']) {
      expect(ids).toContain(id)
    }
  })
})

describe('preset helpers', () => {
  it('matches rclone provider filters', () => {
    expect(matchesProvider('', 'Wasabi')).toBe(true)
    expect(matchesProvider('AWS', 'AWS')).toBe(true)
    expect(matchesProvider('AWS,Ceph', 'Wasabi')).toBe(false)
    expect(matchesProvider('!AWS,Ceph', 'Wasabi')).toBe(true)
    expect(matchesProvider('!AWS,Ceph', 'AWS')).toBe(false)
  })

  it('picks the option variant meant for the provider', () => {
    const options = [
      { name: 'region', provider: 'AWS', id: 'aws' },
      { name: 'region', provider: 'Scaleway', id: 'scw' },
      { name: 'region', provider: '!AWS,Scaleway', id: 'other' },
    ]
    expect(resolveOption(options, 'region', 'Scaleway')?.id).toBe('scw')
    expect(resolveOption(options, 'region', 'Wasabi')?.id).toBe('other')
    expect(resolveOption(options, 'region', 'AWS')?.id).toBe('aws')
    expect(resolveOption(options, 'missing', 'AWS')).toBeUndefined()
  })

  it('filters per-example providers (rclone 1.72+ layout)', () => {
    const options = [{
      name: 'region',
      examples: [
        { value: 'us-east-1', provider: 'AWS' },
        { value: 'fr-par', provider: 'Scaleway' },
        { value: 'auto' },
      ],
    }]
    expect(resolveOption(options, 'region', 'Scaleway')?.examples?.map((e) => e.value)).toEqual(['fr-par', 'auto'])
  })

  it('localizes names and tags, and searches them', () => {
    const other = PRESETS.presets.find((p) => p.id === 's3-other')!
    expect(localized(other.name, 'tr')).toBe('Diğer S3 uyumlu hizmet')
    expect(localized(other.name, 'xx')).toBe('Other S3-compatible service')
    const wasabi = PRESETS.presets.find((p) => p.id === 'wasabi')!
    expect(presetTag(wasabi, 'tr')).toBe('S3 uyumlu')
    expect(searchPresets('nextcl', 'en').map((p) => p.id)).toEqual(['nextcloud'])
    expect(searchPresets('s3 uyumlu', 'tr').length).toBeGreaterThan(20)
  })
})
