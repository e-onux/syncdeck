# SyncDeck MCP server

A standalone MCP server (`packages/mcp-server`) that exposes the rclone-backed
engine to LLM agents. See the package `README.md` for tools, env vars, and Claude
Desktop registration. This doc records the architecture and the phase-2 plan.

## Why a separate package

The engine logic SyncDeck depends on was already extracted into pure helpers
(`app/electron/lib/engine.cjs`). The MCP server imports those directly, so the
GUI and the agent path share **one** implementation of arg-safety, remote-path
validation and secret redaction — they can't drift, which matters because a
divergent escaper is a security hole.

```
LLM / MCP client
      │  stdio (JSON-RPC)
SyncDeck MCP server  (packages/mcp-server)
      │  policy layer  → assertSafeMcpArgs · parseRemoteTarget · redactConfigDump
      │                  remote allowlist · audit log
      ▼
   rclone  →  cloud remotes / local folders
```

## Phase 1 (shipped): read-only + dry-run

`list_profiles`, `get_profile_status`, `list_clients`, `list_remote_folder`,
`search_remote`, `about_remote`, `run_profile_dry_run`. Zero mutations, near-zero
risk, immediately useful ("what's in my Drive / what would this sync do").

## Phase 2 (planned): mutating tools behind app-side approval

The hard part of a *safe* MCP is not the tools — it's **where the human approval
lives**. MCP tool calls are non-interactive, so a destructive tool can't just
"pop a dialog". Two options:

1. Rely on the MCP client's own per-tool approval (simple, but a misconfigured /
   auto-approving client bypasses it).
2. **App-side approval queue (preferred):** the MCP server does not execute a
   destructive op directly — it enqueues a pending action that surfaces in the
   SyncDeck GUI, the user approves it there, and the tool returns "pending,
   id X" with a `get_action_status` poll. This is the same "GUI is the source of
   truth" model as the rest of the app and can't be auto-approved away.

Tools that will require approval: `upload_file`, `download_file`,
`delete_remote_item`, `create_remote_folder`, `run_profile`, `create_profile`,
`create_remote`. The transport stays stdio; the embedded ("MCP Server başlat"
toggle) mode is what makes the app-side queue possible.
