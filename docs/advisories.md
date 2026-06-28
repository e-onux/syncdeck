# SyncDeck advisory feed

SyncDeck polls a small JSON file every 6 hours and shows a dismissible banner for
each advisory that applies to the running install. This lets us warn users about
provider/API breakage (e.g. an OneDrive change that needs a newer rclone) **without
shipping a new app build** — we just edit `advisories.json` on `main`.

- **Live feed:** `advisories.json` at the repo root, served via
  `https://raw.githubusercontent.com/e-onux/syncdeck/main/advisories.json`.
- **Override (staging):** set the `SYNCDECK_ADVISORY_URL` env var.
- **Caching:** last successful fetch is cached to `userData/advisories-cache.json`;
  a network failure silently falls back to it. The feed never blocks startup.

## Schema

```jsonc
{
  "advisories": [
    {
      "id": "onedrive-2026-06",          // required, unique, stable (used for dismissal)
      "severity": "warning",              // "info" | "warning" | "critical"  → banner colour
      "providers": ["onedrive"],          // optional: only show if one of these client types is configured. Omit/[] = all.
      "minRcloneVersion": "1.74.3",       // optional: only show when the INSTALLED rclone is older
      "minAppVersion": "0.3.0",            // optional: only show when the INSTALLED app is older
      "url": "https://rclone.org/...",    // optional "learn more" link (opens externally)
      "action": "update-rclone",          // optional hint; "update-rclone" lets the in-app updater wire a button
      "message": {                          // required: localized map, or a plain string
        "tr": "Microsoft OneDrive hizmet güncellemesi nedeniyle entegrasyonlarımız bu sürümde iş görememektedir. Lütfen sürümünüzü güncelleyin.",
        "en": "Due to a Microsoft OneDrive service update our integration no longer works in this version. Please update."
      }
    }
  ]
}
```

## Matching rules (see `app/electron/lib/engine.cjs` → `matchAdvisories`)

An advisory is shown when **all** hold:

1. It has an `id` and the user hasn't dismissed it.
2. Its `providers` filter (if present) intersects the configured client types.
3. Its version gate triggers — i.e. the installed `rclone`/app version is **older**
   than `minRcloneVersion`/`minAppVersion`. With no version fields it's a plain notice.
   Version-gated advisories are **hidden when the version is unknown**, so a missing
   engine never produces a false "please update" alarm.

The message is resolved to the active UI language, falling back to `en`, then any
present language.
