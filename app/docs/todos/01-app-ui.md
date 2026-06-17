# Backend ToDos: app-ui (Sidre-dark redesign)

The Sidre-dark UI redesign wired to real Electron IPC. The following main-process
(`electron/main.cjs`) work was **done** as part of this change, plus a few
follow-ups that would deepen the live experience.

## Done in this change (electron/main.cjs + preload.cjs + types.d.ts)
- `sync:progress` event — `runRcloneProfile` now streams parsed
  `--stats-one-line` output (`pct`, `speed`, `eta`, `transferred`, `total`) to
  the renderer during a run; the status bar reads it live.
- `remote:list` (`rclone lsjson remote:path`) — backs the cloud file picker
  (folder/file listing, breadcrumb navigation).
- `clients` in `app:get-state` (`rclone config dump`) — name + type for the
  client chips and the Settings → Clients list.
- `open:external` (`shell.openExternal`) — the About tab links.

## Follow-ups (nice to have, not blocking)

### Live file count in the status bar
- **Why:** the status bar shows a `Dosya` (files) slot; currently rendered as
  `—` because `--stats-one-line` only carries bytes/pct/speed/eta.
- **Approach:** run with full `--stats` (multi-line) and parse the
  `Transferred: N / M` (no units) file-count line, or add `--use-json-log` and
  parse JSON stat events. Send `files` + `totalFiles` on the `sync:progress`
  payload (already typed loosely on `SyncProgress`).
- **UI stub:** `src/App.tsx` `StatusBar` renders `—` for files.

### Wizard OAuth browser flow
- **Why:** the client wizard for Drive/Dropbox shows "Tarayıcıda yetkilendir"
  but currently just runs `rclone config create <name> <type>` (no interactive
  OAuth capture).
- **Approach:** `rclone config create … --all` / `rclone authorize`, capture the
  localhost OAuth callback in the main process, feed the token back. Expose a
  `remote:authorize` IPC.
- **UI stub:** the wizard's auth button is presentational; creation still works
  for key-based providers (S3/B2/SFTP/WebDAV) and for Drive/Dropbox without a
  custom client id.

### Real connection status + run cancellation
- **Why:** the title bar / status dot reflect "running" from the in-flight
  `runSync` promise; there's no per-remote reachability check, and a running
  sync can't be cancelled from the UI.
- **Approach:** add `sync:cancel` (kill the child process) and an optional
  `remote:about` (`rclone about remote:`) for quota/connection health.
