#!/usr/bin/env node
// Checks sources/provider-presets.json against a real rclone binary, so a
// renamed or removed provider/option upstream is caught before people see a
// broken entry in the client wizard.
//
//   node scripts/check-presets.mjs [path/to/rclone]
//
// For every preset: the backend exists, each fixed setting names a real option
// (and, for choice options such as s3 "provider", a value rclone offers), and
// every shown field resolves to an option meant for that provider.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const rclone = process.argv[2] || process.env.RCLONE || 'rclone'
const catalogPath = fileURLToPath(new URL('../../sources/provider-presets.json', import.meta.url))
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const providers = JSON.parse(execFileSync(rclone, ['config', 'providers'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
const version = execFileSync(rclone, ['version'], { encoding: 'utf8' }).split('\n')[0]

function matchesProvider(filter, provider) {
  if (!filter || !provider) return true
  const negate = filter.startsWith('!')
  const list = (negate ? filter.slice(1) : filter).split(',').map((p) => p.trim())
  return list.includes(provider) !== negate
}

const errors = []
for (const preset of catalog.presets) {
  const where = `${preset.id} (${preset.backend})`
  const backend = providers.find((p) => p.Name === preset.backend || p.Prefix === preset.backend)
  if (!backend) {
    errors.push(`${where}: backend not in rclone`)
    continue
  }
  const options = backend.Options || []
  const provider = preset.set?.provider
  for (const [key, value] of Object.entries(preset.set || {})) {
    const variants = options.filter((o) => o.Name === key)
    if (!variants.length) {
      errors.push(`${where}: fixed setting "${key}" is not an option`)
      continue
    }
    const choices = variants.flatMap((o) => o.Examples || []).map((e) => e.Value)
    if (variants.some((o) => o.Exclusive || key === 'provider' || key === 'vendor') && choices.length && !choices.includes(value)) {
      errors.push(`${where}: "${key}" = "${value}" is not one of rclone's values`)
    }
  }
  for (const key of preset.fields) {
    const match = options.find((o) => o.Name === key && matchesProvider(o.Provider, provider))
    if (!match) errors.push(`${where}: field "${key}" has no option for provider ${provider ?? '(any)'}`)
  }
}

if (errors.length) {
  console.error(`${errors.length} problem(s) with ${version}:`)
  for (const line of errors) console.error(`  - ${line}`)
  process.exit(1)
}
console.log(`${catalog.presets.length} presets OK against ${version}`)
