# SyncDeck

SyncDeck is a cross-platform Ionic + React + Electron desktop app that provides a graphical wrapper around `rclone`.

Important attribution: `rclone` is an independent open-source project maintained by the rclone developers. SyncDeck depends on rclone, calls rclone commands, and gives explicit credit in the About dialog.

## Installing a release

Download the build for your OS from [Releases](https://github.com/e-onux/syncdeck/releases). rclone ships inside the app — no separate install.

Because the app is distributed **unsigned** (free, no Apple Developer account), each OS shows a one-time prompt. macOS builds are ad-hoc signed so the bundle is internally valid, but they are not Apple-notarized:

- **macOS** — if you see *"SyncDeck is damaged and can't be opened"* (German: *"ist beschädigt"*), the file is usually **not** corrupt — it is Gatekeeper quarantine on an unsigned, unnotarized app. Drag the app to `Applications`, then run once:
  ```bash
  xattr -dr com.apple.quarantine /Applications/SyncDeck.app
  ```
  It then opens normally. The bundled rclone inside the app is un-quarantined by the same recursive command.
- **Windows** — on *"Windows protected your PC"*, click **More info → Run anyway**.
- **Linux** — make the AppImage executable (`chmod +x SyncDeck-*.AppImage`) or install the `.deb`.

### Signing & notarization (optional, removes the macOS prompt)

To make macOS downloads open with no command, build with an Apple Developer ID. Add these repo secrets, then wire them as `env` on the bundle step in [`.github/workflows/release.yml`](../.github/workflows/release.yml) (a commented stub marks the spot — they are not wired by default because an empty `CSC_LINK` makes electron-builder abort):

- `CSC_LINK` — base64 of your Developer ID `.p12`
- `CSC_KEY_PASSWORD` — the `.p12` password
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` — for notarization

## Current Features

- Sync profiles with source, destination, mode, extra rclone arguments, and startup enablement.
- Transfer operations without mounting: `sync`, `copy`, `move`, `bisync` (with
  automatic first-run `--resync`), and `check`.
- Live progress streaming during a run (bytes, %, speed, ETA, file count) parsed
  from `--use-json-log`, plus a readable live log and a working **Stop** button
  (`sync:cancel`).
- Native folder picker for local paths; cloud file picker via `rclone lsjson`.
- Client wizard that creates real remotes:
  - Per-provider field schemas for S3, B2, SFTP, WebDAV, and an encrypted
    `crypt` remote — passwords stored obscured (`--obscure`).
  - Real OAuth for Drive/Dropbox via `rclone authorize` (browser flow, token
    capture).
  - Connection test (`rclone lsd`, also via on-the-fly connection strings) and
    per-client delete (`rclone config delete`).
- Settings → Clients shows per-client quota/free space (`rclone about`).
- Startup sync support:
  - macOS: LaunchAgent
  - Windows/macOS packaged builds: Electron login item support
- Remote listing via `rclone listremotes` + `rclone config dump`.
- Multilanguage UI foundation: `en`, `es`, `de`, `nl`, `zh`, `tr`, `ja`, `ar`, `ru`.
- Standalone build scripts for macOS, Windows, and Linux via Electron Builder.

## Requirements

For development, install rclone separately:

```bash
brew install rclone
```

SyncDeck searches for rclone in:

- Bundled app resources: `bin/<platform>/<arch>/rclone`
- `RCLONE_PATH`
- `/opt/homebrew/bin/rclone`
- `/usr/local/bin/rclone`
- `/usr/bin/rclone`
- `which rclone`

To make the app truly standalone, place platform-specific rclone binaries under:

```text
bin/darwin/arm64/rclone
bin/darwin/x64/rclone
bin/win32/x64/rclone.exe
bin/linux/x64/rclone
```

Electron Builder will copy `bin/` into app resources.

## Development

```bash
npm install
npm run dev
```

## Build Checks

```bash
npm run lint
npm run build
```

## Standalone Bundles

```bash
npm run bundle:mac
npm run bundle:win
npm run bundle:linux
```

## Roadmap To Complete rclone Wrapper

Done: provider wizards (Drive, Dropbox, S3, B2, SFTP, WebDAV, crypt) with OAuth
capture and `--obscure`; copy/sync/move/bisync/check; dry-run, bandwidth, and
checksum toggles; live progress streaming; `lsjson` picker; `about` quota;
config create/delete. Still to do:

- More backends in the wizard (OneDrive, SMB, Proton Drive, Box, pCloud …) and
  backend-specific flag forms.
- Long-running `mount` / `serve` with a dedicated daemon panel.
- Scheduler (interval/cron per profile), job queue, and conflict-policy presets.
- Persistent run/log history and additional ops (`dedupe`, `purge`, `cleanup`,
  `size`).

## UI / Design

The interface follows the **Sidre Labs** design system (deep teal-black canvas,
oblique Archivo headlines, JetBrains Mono labels, mint accent, 2px corners, no
shadows) — the same language as the product site.

- Design source (Claude Design handoff): [`docs/designs/app-ui/`](docs/designs/app-ui/) (`SyncDeck.dc.html` + `_ds/` tokens + chat transcripts).
- Single-window layout: title bar · profile sidebar · profile editor · global
  status bar, with overlay surfaces for Settings (Arayüz / İstemciler / Hakkında),
  a 3-step client wizard (live engine-command preview), and a cloud file picker.
- The UI calls the engine "motor"; rclone is credited only in About.
- Live status bar, cloud picker, client types and external links are wired to
  real `electron/main.cjs` IPC (progress streaming, `lsjson`, `config dump`,
  `openExternal`). Remaining backend follow-ups: [`docs/todos/01-app-ui.md`](docs/todos/01-app-ui.md).
