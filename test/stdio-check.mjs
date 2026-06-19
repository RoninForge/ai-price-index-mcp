// End-to-end check: spawns the bin as a real subprocess and drives it over stdio with raw JSON-RPC
// (initialize -> tools/list -> a call to EVERY tool -> an error path). Proves the npx-style entrypoint
// serves the protocol on stdin/stdout, that every tool round-trips over the real transport, and that a
// failed lookup comes back as an MCP tool error (isError: true) rather than a crash. No network, no keys.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const bin = fileURLToPath(new URL('../bin/server.js', import.meta.url));
const child = spawn('node', [bin], { stdio: ['pipe', 'pipe', 'inherit'] });

let buf = '';
const pending = [];
child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const lineStr = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (lineStr) pending.push(JSON.parse(lineStr));
  }
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return id;
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}
async function waitFor(id, ms = 5000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const hit = pending.find((m) => m.id === id);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('timeout waiting for response id ' + id);
}

// Call a tool and return { parsed, isError } from the CallToolResult.
async function callTool(name, args) {
  const id = send('tools/call', { name, arguments: args });
  const res = await waitFor(id);
  assert.ok(res.result, `tools/call ${name} returned no result: ${JSON.stringify(res.error)}`);
  const text = res.result.content?.[0]?.text;
  assert.ok(text, `tools/call ${name} returned no text content`);
  return { parsed: JSON.parse(text), isError: Boolean(res.result.isError) };
}

async function main() {
  const initId = send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'stdio-check', version: '0.0.0' }
  });
  const init = await waitFor(initId);
  assert.equal(init.result.serverInfo.name, 'ai-price-index', 'unexpected server name');
  assert.ok(init.result.instructions, 'server did not advertise instructions');
  console.log('initialize ->', JSON.stringify(init.result.serverInfo), '| instructions:', Boolean(init.result.instructions));

  notify('notifications/initialized', {});

  const listId = send('tools/list', {});
  const list = await waitFor(listId);
  const names = list.result.tools.map((t) => t.name);
  assert.deepEqual(
    [...names].sort(),
    ['compare', 'cost_from_usage', 'current_price', 'list_models', 'price_on'],
    'unexpected tool set: ' + names.join(', ')
  );
  console.log('tools/list ->', names.join(', '));

  // current_price: a real hit, not an error.
  {
    const { parsed, isError } = await callTool('current_price', { model: 'claude-opus-4-8' });
    assert.equal(isError, false, 'current_price should not be an error');
    assert.equal(typeof parsed.input?.usd_per_mtok, 'number', 'current_price missing input price');
    console.log(`current_price claude-opus-4-8 -> in $${parsed.input.usd_per_mtok} / out $${parsed.output.usd_per_mtok}`);
  }

  // price_on: the point-in-time differentiator, with a known archived value.
  {
    const { parsed, isError } = await callTool('price_on', { model: 'gpt-4', date: '2024-01-01' });
    assert.equal(isError, false, 'price_on should not be an error');
    assert.equal(parsed.input.usd_per_mtok, 30, 'gpt-4 2024-01-01 input should be $30');
    assert.equal(parsed.output.usd_per_mtok, 60, 'gpt-4 2024-01-01 output should be $60');
    assert.ok(parsed.input.source_url, 'price_on missing source_url');
    console.log(`price_on gpt-4@2024-01-01 -> in $${parsed.input.usd_per_mtok} / out $${parsed.output.usd_per_mtok} src=${parsed.input.source_url}`);
  }

  // compare: a row per requested model.
  {
    const models = ['claude-opus-4-8', 'gpt-4o', 'gemini-2.5-pro'];
    const { parsed, isError } = await callTool('compare', { models });
    assert.equal(isError, false, 'compare should not be an error');
    assert.equal(parsed.count, models.length, `compare should return ${models.length} rows`);
    console.log(`compare -> ${parsed.rows.map((r) => r.model || r.error).join(', ')}`);
  }

  // cost_from_usage: a positive dollar value back.
  {
    const { parsed, isError } = await callTool('cost_from_usage', {
      model: 'claude-opus-4-8',
      tokens: { input: 1000000, output: 250000 }
    });
    assert.equal(isError, false, 'cost_from_usage should not be an error');
    assert.ok(typeof parsed.usd === 'number' && parsed.usd > 0, 'cost_from_usage missing usd');
    console.log(`cost_from_usage 1M in + 250K out -> $${parsed.usd} (${parsed.cents}c)`);
  }

  // list_models: a non-empty list for a known provider.
  {
    const { parsed, isError } = await callTool('list_models', { provider: 'anthropic' });
    assert.equal(isError, false, 'list_models should not be an error');
    assert.ok(parsed.count > 0, 'list_models anthropic should be non-empty');
    console.log(`list_models anthropic -> ${parsed.count} models`);
  }

  // Error path: an unknown id must come back as an MCP tool error (isError: true), not a crash.
  {
    const { parsed, isError } = await callTool('current_price', { model: 'not-a-real-model' });
    assert.equal(isError, true, 'unknown model must set isError: true');
    assert.equal(parsed.error, 'model_not_found', 'unknown model should report model_not_found');
    console.log(`current_price not-a-real-model -> isError:true error:${parsed.error} (clean)`);
  }

  // Error path: a malformed date is a clean bad_date error, not a crash.
  {
    const { parsed, isError } = await callTool('price_on', { model: 'gpt-4', date: 'nonsense' });
    assert.equal(isError, true, 'malformed date must set isError: true');
    assert.equal(parsed.error, 'bad_date', 'malformed date should report bad_date');
    console.log(`price_on gpt-4@nonsense -> isError:true error:${parsed.error} (clean)`);
  }

  // Coverage edge: a date before the model existed is a valid hit with covered:false and a note, NOT
  // an error. The agent should still get an honest, usable answer.
  {
    const { parsed, isError } = await callTool('price_on', { model: 'gpt-4', date: '2020-01-01' });
    assert.equal(isError, false, 'a pre-coverage date is not an error');
    assert.equal(parsed.covered, false, 'gpt-4 in 2020 should be covered:false');
    assert.ok(parsed.note, 'a pre-coverage result should carry an explanatory note');
    console.log('price_on gpt-4@2020-01-01 -> covered:false, note present (not an error)');
  }

  child.kill();
  console.log('STDIO E2E OK (5 tools + error path over real subprocess)');
}

main().catch((e) => {
  console.error('STDIO E2E FAILED:', e);
  child.kill();
  process.exit(1);
});
