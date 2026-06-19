// In-memory smoke test: starts the real MCP server, connects a real MCP client over an in-memory
// transport pair, lists tools, and calls each tool once. Exercises the full request/response path
// (schema validation, handler, JSON content) without spawning a subprocess or touching the network.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';

const line = (s) => process.stdout.write(s + '\n');

function show(title, result) {
  line('');
  line('=== ' + title + ' ===');
  // Tool results carry their payload as text content; print it verbatim.
  for (const c of result.content ?? []) {
    if (c.type === 'text') line(c.text);
  }
}

async function main() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  const client = new Client({ name: 'smoke-test', version: '0.0.0' }, { capabilities: {} });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const caps = client.getServerCapabilities();
  line('server capabilities: ' + JSON.stringify(caps));
  const inst = client.getInstructions();
  line('instructions present: ' + (inst ? 'yes (' + inst.length + ' chars)' : 'no'));

  const tools = await client.listTools();
  line('');
  line('=== list_tools (' + tools.tools.length + ') ===');
  for (const t of tools.tools) {
    line('- ' + t.name + ': ' + (t.description || '').slice(0, 72) + '...');
  }

  show(
    'current_price { model: "claude-opus-4-8" }',
    await client.callTool({ name: 'current_price', arguments: { model: 'claude-opus-4-8' } })
  );

  show(
    'price_on { model: "gpt-4", date: "2024-01-01" }  (point-in-time)',
    await client.callTool({ name: 'price_on', arguments: { model: 'gpt-4', date: '2024-01-01' } })
  );

  show(
    'compare { models: ["claude-opus-4-8", "gpt-4o", "gemini-2.5-pro"] }',
    await client.callTool({
      name: 'compare',
      arguments: { models: ['claude-opus-4-8', 'gpt-4o', 'gemini-2.5-pro'] }
    })
  );

  show(
    'cost_from_usage { model: "claude-opus-4-8", tokens: { input: 1000000, output: 250000 } }',
    await client.callTool({
      name: 'cost_from_usage',
      arguments: { model: 'claude-opus-4-8', tokens: { input: 1000000, output: 250000 } }
    })
  );

  show(
    'list_models { provider: "anthropic" }',
    await client.callTool({ name: 'list_models', arguments: { provider: 'anthropic' } })
  );

  // A couple of negative paths to prove clean structured errors rather than crashes.
  show(
    'current_price { model: "not-a-real-model" }  (error path)',
    await client.callTool({ name: 'current_price', arguments: { model: 'not-a-real-model' } })
  );

  await client.close();
  await server.close();
  line('');
  line('SMOKE TEST OK');
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
