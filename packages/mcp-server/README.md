# @syncdeck/mcp-server

A Model Context Protocol server that exposes SyncDeck's rclone-backed engine to
LLM agents (Claude Desktop, Claude Code, …) through a **read-only + dry-run** tool
set. The value here is the **policy layer**, not the tools: a naive "rclone over
MCP" is trivial and dangerous, so this server is safe-by-construction.

## Tools (MVP — phase 1)

| Tool | Effect |
| --- | --- |
| `list_profiles` | List sync profiles (read-only) |
| `get_profile_status` | Last run result + log tail for a profile |
| `list_clients` | Configured remotes (name + type; **secrets redacted**) |
| `list_remote_folder` | List one remote folder (`remote:sub/dir`) |
| `search_remote` | Recursive filename search on a remote |
| `about_remote` | Quota / usage for a remote |
| `run_profile_dry_run` | `--dry-run` a profile: reports what *would* change, changes nothing |

Every tool is read-only or dry-run. Mutating tools (upload/download/run_profile,
create/delete remote) are **phase 2** and will route through an app-side approval
queue — see `docs/mcp-server.md`.

## Security model

- **Shared policy code.** Arg-safety, remote-path validation and secret redaction
  come from the same `app/electron/lib/engine.cjs` the GUI uses, so the two paths
  can't drift (`assertSafeMcpArgs`, `parseRemoteTarget`, `redactConfigDump`).
- **Remote allowlist.** Set `SYNCDECK_MCP_REMOTES=gdrive,onedrive` to restrict
  access to those remotes. Unset = all configured remotes (still read-only).
- **No flag injection.** A profile's `extraArgs` is tokenized and screened against
  a denylist (`--config`, `--rc`, `--drive-impersonate`, `--files-from`, …) before
  any dry-run. Agent-supplied paths must be `remote:sub` with no `..` and no
  leading `-`.
- **No secret leakage.** `config dump` is redacted before it can reach a result.
- **Audit log.** Every tool call is appended to `<userData>/mcp-audit.log`.

## Configuration (env)

| Var | Meaning |
| --- | --- |
| `SYNCDECK_MCP_REMOTES` | Comma-separated remote allowlist (bare names) |
| `SYNCDECK_RCLONE` / `RCLONE_PATH` | Explicit rclone binary path |
| `SYNCDECK_CONFIG_DIR` | Override the SyncDeck userData dir (where `profiles.json` lives) |

The server otherwise auto-detects the SyncDeck config dir per-OS and prefers the
self-updated engine in `<userData>/engine`, falling back to `which rclone`.

## Install & run

```bash
cd packages/mcp-server
npm install
npm run smoke   # spawns the server and exercises the read-only tools
```

### Register with Claude Desktop

Add to `claude_desktop_config.json`:

```jsonc
{
  "mcpServers": {
    "syncdeck": {
      "command": "node",
      "args": ["/absolute/path/to/sync-deck/packages/mcp-server/index.mjs"],
      "env": { "SYNCDECK_MCP_REMOTES": "gdrive,onedrive" }
    }
  }
}
```
