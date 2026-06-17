# SyncDeck

SyncDeck is a cross-platform Ionic + React + Electron desktop app that provides a graphical wrapper around `rclone`.

Important attribution: `rclone` is an independent open-source project maintained by the rclone developers. SyncDeck depends on rclone, calls rclone commands, and gives explicit credit in the About dialog.

## Current Features

- Sync profiles with source, destination, mode, extra rclone arguments, and startup enablement.
- `rclone sync` and `rclone copy` execution without mounting.
- Native folder picker for local paths.
- Startup sync support:
  - macOS: LaunchAgent
  - Windows/macOS packaged builds: Electron login item support
- Remote/client panel that can call `rclone config create`.
- Remote listing via `rclone listremotes`.
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

- Provider-specific remote wizards for Drive, Dropbox, OneDrive, S3, B2, SFTP, WebDAV, SMB, Proton Drive, and more.
- OAuth browser callback capture where the provider allows it.
- GUI coverage for copy, sync, move, bisync, check, mount, serve, crypt, obscure, dedupe, purge, cleanup, ls/json, size, config edit/delete, and backend-specific flags.
- Job queue, scheduler, dry-run preview, conflict policy, bandwidth controls, progress streaming, and log history.

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
