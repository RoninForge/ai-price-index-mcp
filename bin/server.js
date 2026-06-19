#!/usr/bin/env node
// stdio entrypoint for the AI Price Index MCP server. Drop the JSON below into a Claude Code or Cursor
// MCP config and the agent gets read-only, zero-key, point-in-time AI price lookups. No network, no
// keys, no prompts: the dated dataset is bundled inside the ai-price-index dependency.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from '../src/server.js';

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never write to stdout here: stdout is the JSON-RPC channel. Diagnostics go to stderr only.
  process.stderr.write('ai-price-index-mcp ready on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`ai-price-index-mcp failed to start: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
