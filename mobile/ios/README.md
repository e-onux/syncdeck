# SyncDeck for iPhone and iPad

A native SwiftUI app with the same job as the desktop app: sync a folder with
any cloud, without mounting anything. It links rclone in-process
(`mobile/engine`, built with gomobile) because iOS does not allow an app to
start the rclone CLI as a child process. The app talks to the engine through
rclone's remote-control API (`sync/sync`, `operations/list`, `config/create`
and so on) instead of command-line flags.

## Free up space: photos to the cloud

The main phone use case. A "Photos to cloud" profile backs up the photo
library and can then remove the backed-up items from the iPhone:

1. Photos and videos older than the "keep on iPhone" window are exported in
   small batches (originals, edited versions and the video half of Live
   Photos) to a temporary folder, into `year/month/` folders with their
   original names and capture dates.
2. Each batch is uploaded, then rclone compares every file with the cloud
   copy (`operations/check`: size, plus checksum where the provider has one).
3. Only items whose every file matched are offered for removal. iOS asks the
   person to confirm and keeps removed items in Recently Deleted for 30 days.
   Anything that failed to export, upload or verify stays on the device.
4. In the background iOS cannot ask, so verified items wait and the app shows
   a "Remove from iPhone" button the next time it is opened.

`PhotoBackupTests` covers this against a real upload (WebDAV), including the
unhappy paths: unreadable originals, incomplete uploads, a declined
confirmation and background runs.

## Keeping rclone out of sight

People should not need to know rclone. Provider names are plain ("OneDrive",
"Windows share / NAS"), OAuth providers show only a name and a "Sign in"
button, rclone's follow-up setup questions are answered with safe defaults
(`RemoteService.autoAnswer`) and only shown when a real choice is needed,
errors are explained in plain language with the raw text under "Details", and
option keys, tokens and extra rclone arguments live under "Advanced" or
"Technical details".

## Build

```bash
cd mobile/ios
scripts/fetch-engine.sh          # or: scripts/fetch-engine.sh --build (needs Go)
open SyncDeck.xcodeproj
```

`fetch-engine.sh` downloads `Rclone.xcframework` from the `engine-v<version>`
release made by `.github/workflows/rclone-mobile.yml`, where `<version>` is
`app/rclone.version`, and checks its SHA-256. The framework is not committed.

Requirements: Xcode 16 or later, iOS 17 or later. The project uses
synchronized folders, so new Swift files under `SyncDeck/` are picked up with
no project edits.

## Tests

```bash
scripts/integration-test.sh "iPhone 16 Pro"
```

This runs the unit tests and `EngineIntegrationTests`. Those start a WebDAV and
an SFTP server on 127.0.0.1 with the host's `rclone serve` and throwaway
credentials, then drive the real engine through every operation: creating,
testing, browsing and deleting clients; copy, mirror sync, move, two-way
(bisync, including the automatic first-run resync) and verify (check);
dry run, filters, bandwidth limit and stop; an encrypted (crypt) client on top
of WebDAV; and the "session expired" alert. Plain `xcodebuild test` skips the
integration suite. CI runs the same script (`.github/workflows/ios.yml`).

## Features

| Desktop | iPhone |
|---|---|
| Profiles: source, destination, mode, extra args, schedule | Same. Local paths are the app's own folder (Files > On My iPhone > SyncDeck) or any folder linked once from the Files picker (On My iPhone, iCloud Drive, USB drives, other apps). Linked folders are kept as security-scoped bookmarks and can be browsed into, so any subfolder can be synced, and new folders created |
| sync, copy, move, bisync (automatic first-run resync), check | Same |
| Live progress, per-file log, Stop | Same, polled from `core/stats` and `core/transferred` |
| Dry run, checksum, bandwidth toggles | Same. Other extra arguments are mapped to rc options: filters, `--transfers`, `--checkers`, `--ignore-existing`, `--update`, `--size-only`, `--max-delete`, `--backup-dir` and more. Anything else is listed as ignored in the run log |
| Client wizard with OAuth, connection test, quota, delete, reconnect | Same. OAuth opens the provider's sign-in in an in-app Safari sheet, using rclone's own local callback |
| Wizard driven by `rclone config providers` | Same, limited to the backends compiled into the engine (`mobile/engine/syncdeck.go`). Follow-up questions (e.g. which OneDrive drive) are asked in the app |
| Well-known services by name (S3-compatible, WebDAV, servers and NAS) | Same catalogue (`sources/provider-presets.json`, copied in by `scripts/build-strings.py`); `PresetTests` checks every entry against the linked engine |
| Background scheduler (LaunchAgent) | `BGTaskScheduler`: scheduled profiles run when you open the app and when iOS grants background time. iOS picks the exact moment |
| Run history | Last 20 runs per profile, with full output and share sheet |
| Advisory feed | Same feed (`advisories.json`), same filtering rules |
| Engine self-update | Not possible on iOS: the engine ships inside the app and updates with it |
| 9 languages | Same 9, in `SyncDeck/Localizable.xcstrings` (generated from `scripts/translations.tsv` by `scripts/build-strings.py`) |

## Layout

```
SyncDeck/
  SyncDeckApp.swift        entry point, engine boot, scene lifecycle
  Engine/                  rclone bridge: rc calls, log capture, OAuth, runner
  Core/                    models, persistence, paths, scheduler, advisories
  Views/                   SwiftUI screens
SyncDeckTests/             unit + engine integration tests
scripts/                   fetch-engine, integration-test, string catalog
```

Remotes live in rclone's own config file under Application Support (never in
Documents, so they are not visible in the Files app). Profiles and run history
are in `state.json` next to it.
