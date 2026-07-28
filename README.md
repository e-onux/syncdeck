# SyncDeck

SyncDeck is a cross-platform desktop app that puts a calm graphical interface on
top of `rclone`. It syncs any local folder to any cloud without mounting a drive
(mirror sync or safe copy). A **Sidre Labs** product.

Live site: **https://sidrelabs.com/syncdeck/** · Downloads: [Releases](https://github.com/e-onux/syncdeck/releases)

## Repository layout

This is a monorepo holding the product and everything around it:

| Directory | What | Stack |
|---|---|---|
| [`app/`](app/) | The desktop app | Ionic + React + Electron, electron-builder |
| [`website/`](website/) | Product site (`sidrelabs.com/syncdeck`) | Static, speed-first build, nginx on K3s |
| [`packages/mcp-server/`](packages/mcp-server/) | MCP server exposing the engine to LLM agents | Node, `@modelcontextprotocol/sdk` |
| [`docs/`](docs/) | Architecture notes (advisories, engine updates, MCP) | Markdown |

## app/, the desktop app

```bash
cd app
npm install
npm run dev            # Vite + Electron
npm run build          # tsc + vite build
npm test               # vitest
npm run bundle:mac     # standalone .dmg/.zip (bundle:win / bundle:linux for the others)
```

Details: [`app/README.md`](app/README.md). Releases are built by GitHub Actions
when a `v*` tag is pushed (see `.github/workflows/release.yml`).

## website/, the product site

```bash
cd website
npm install
npm run build          # one self-contained page per language
npm run preview        # http://localhost:8080
```

Deployed under the `sidrelabs.com/syncdeck` sub-path. Build and deploy details:
[`website/README.md`](website/README.md).

## packages/mcp-server/, the MCP server

A read-only and dry-run MCP server that lets an LLM agent inspect profiles,
browse remotes and preview what a sync would do, behind a policy layer.

```bash
cd packages/mcp-server
npm install
npm run smoke
```

Details: [`packages/mcp-server/README.md`](packages/mcp-server/README.md) and
[`docs/mcp-server.md`](docs/mcp-server.md).

## Keeping the engine current

Cloud providers change their APIs, so the bundled rclone has to keep up. Two
independent layers handle that, described in [`docs/engine-update.md`](docs/engine-update.md):

1. **In-app engine self-update**, gated behind a compatibility smoke test.
2. **CI auto-release**, a daily workflow that watches upstream rclone and tags a
   rebuild when a newer version appears.

A small [advisory feed](docs/advisories.md) can also surface a provider-specific
notice in the app without shipping a new build.

## Links

- Site: https://sidrelabs.com/syncdeck
- Source: https://github.com/e-onux/syncdeck
- rclone is a trademark of the independent open-source project team. SyncDeck is
  a wrapper around it and credits it in the About dialog.
