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

## Done in the "make everything work" pass

### Live file count in the status bar ✓
- `runRcloneProfile` now runs with `--use-json-log --stats=1s -v` and parses the
  JSON `stats` object, so `sync:progress` carries `files`/`totalFiles` (plus
  robust bytes/pct/speed/eta and `errors`). The JSON log is also reshaped into a
  readable live log. `StatusBar` renders the real `Dosya` count.

### Wizard OAuth browser flow ✓
- `remote:authorize` IPC runs `rclone authorize "<type>"` (optionally with a
  custom client id/secret), opens the browser, captures the token JSON printed
  between rclone's `--->` / `<---` markers, and `createRemote` saves it with
  `token <json> config_is_local false`. The wizard's "Tarayıcıda yetkilendir"
  button is wired and shows authorized/failed state.
- The wizard now renders **per-provider field schemas** (S3 key+secret+region+
  endpoint, B2 account+key, SFTP host/user/port/pass/key, WebDAV url/vendor/
  user/pass) and passes them all as `rclone config create` options with
  `--obscure` so password fields are stored correctly.

### Run cancellation + connection test ✓
- `sync:cancel` IPC kills the tracked child (SIGINT, or `taskkill /T /F` on
  Windows); the run resolves gracefully and the Stop button is live.
- `remote:test` (`rclone lsd`, accepts a saved name or an on-the-fly connection
  string) backs the wizard "Bağlantıyı test et" button and the per-client test
  in Settings → Clients.
- `remote:delete` (`rclone config delete`) backs the per-client delete button.

## Done in the "expand coverage" pass
- **Operations**: profiles now run `sync`, `copy`, `move`, `bisync`, and
  `check` (the mode panel renders all five). `--create-empty-src-dirs` is gated
  to sync/copy/move; bisync auto-adds `--resync` on first run, tracked via
  `config.bisyncReady`.
- **crypt remote type**: the wizard can create an encrypted remote that wraps an
  existing one (remote + password + optional salt), obscured via `--obscure`.
- **`remote:about`** (`rclone about --json`): Settings → Clients shows
  humanized free/total quota per client (graceful when a backend has no `about`).

## Remaining roadmap (larger, separate surfaces)
- `mount` / `serve` — long-running daemons; need a dedicated panel with
  start/stop and mount-point management (different from one-shot profiles).
- Scheduler — per-profile interval/cron scheduling beyond launch-at-login.
- Persistent run/log history — a browsable list of past runs (currently only
  the latest run per profile is kept).
- Per-remote reachability polling on launch; `dedupe` / `purge` / `cleanup`.
