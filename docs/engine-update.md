# rclone engine: staleness strategy

Two independent layers keep the bundled rclone working as cloud providers change.

## 1. In-app core self-update (fast path, no app release)

Settings → About → **Sync engine** shows the installed rclone version and offers
an update; the advisory banner's **Update engine** button does the same.

Flow (`app/electron/main.cjs` → `updateRcloneEngine`):

1. `rclone selfupdate --output <userData>/engine/rclone-staged` — rclone downloads
   the latest stable build and **verifies it itself** (hashsum + cryptographic
   signature).
2. macOS: ad-hoc sign (`codesign --force --sign -`) + strip quarantine — the new
   binary lives *outside* the signed app bundle, so this never invalidates the
   bundle's signature (the cause of the old "is damaged" Gatekeeper error).
3. **Compatibility smoke test** (`smokeTestRclone` + `ENGINE_SMOKE_CHECKS`): the
   staged binary must run and still expose every command/flag SyncDeck depends on
   (verified via real `--help` output). This is the "uyumluluk kontrolü".
4. Only on PASS is it promoted (atomic rename) to `<userData>/engine/rclone`,
   which `findRclone()` prefers over the bundled binary. On FAIL it's deleted and
   the app keeps using the previous engine.

`resetEngine` deletes the managed copy to fall back to the bundled binary.

## 2. CI auto-release (keeps new installs fresh) — `.github/workflows/rclone-watch.yml`

Daily, the workflow compares `https://downloads.rclone.org/version.txt` with
`app/rclone.version`. When upstream is newer it records the version, bumps the app
patch version, commits, and pushes a `v*` tag — which triggers `release.yml` to
rebuild SyncDeck bundling the fresh engine.

### Required secret: `RELEASE_PAT`

GitHub's default `GITHUB_TOKEN` **cannot trigger another workflow**, so a tag it
pushes would not start `release.yml`. Add a fine-grained PAT with `contents: write`
on this repo as the `RELEASE_PAT` secret. Without it the tag is still created, but
you must run `release.yml` manually (workflow_dispatch).

`app/scripts/download-rclone.cjs` pins to `app/rclone.version` when present so
builds are reproducible; otherwise it fetches `-current-`.
