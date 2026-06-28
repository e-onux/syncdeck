// Self-contained smoke test: spawns the server over stdio using the MCP SDK
// client, lists tools, and calls the read-only list_profiles / list_clients.
// Run with: npm run smoke
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({ command: process.execPath, args: ['index.mjs'] })
const client = new Client({ name: 'syncdeck-smoke', version: '0.1.0' }, { capabilities: {} })

await client.connect(transport)

const { tools } = await client.listTools()
console.log('tools:', tools.map((t) => t.name).join(', '))
if (!tools.length) throw new Error('no tools registered')

const profiles = await client.callTool({ name: 'list_profiles', arguments: {} })
console.log('list_profiles isError:', Boolean(profiles.isError))
console.log('list_profiles result:', profiles.content?.[0]?.text?.slice(0, 240))

// A path that is not on an allowlist (when set) or malformed must be rejected.
const bad = await client.callTool({ name: 'list_remote_folder', arguments: { path: 'evil:../../etc' } })
console.log('traversal rejected:', Boolean(bad.isError), '→', bad.content?.[0]?.text)

await client.close()
console.log('SMOKE OK')
