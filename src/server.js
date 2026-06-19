// Builds the read-only, zero-key MCP server for the AI Price Index.
//
// It registers a small set of price-lookup tools, each backed by the ai-price-index library (dated,
// first-party-sourced prices bundled inline, no runtime network). The headline capability is
// point-in-time lookup: what a model cost on a given date, with the source that proves it.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createRequire } from 'node:module';
import {
  currentPrice,
  priceOnDate,
  compare,
  costFromUsage,
  listModels
} from './tools.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const INSTRUCTIONS = [
  'Read-only, zero-key access to the open AI Price Index: dated, first-party-sourced AI model API',
  'prices. Unlike current-only price lists, this can answer what a model cost on a past date.',
  'Model ids resolve through the dataset aliases, so short Claude Code ids work (e.g.',
  'claude-opus-4-5). Every result carries its source URL, last_validated date, confidence, and the CC BY 4.0',
  'attribution so you can cite the number. Prices are usd_per_mtok (USD per million tokens).'
].join(' ');

// Wrap a plain handler so its structured object is returned as pretty JSON text content. We always
// return the object as text (the universal content type) rather than relying on output schemas. A
// handler that returns a payload with an `error` field, or that throws unexpectedly, is surfaced as an
// MCP tool error (isError: true) so the client can tell a failed lookup from a hit while still reading
// the structured explanation.
function asTool(fn) {
  return async (args) => {
    let data;
    try {
      data = fn(args ?? {});
    } catch (err) {
      data = { error: 'internal_error', message: String(err && err.message ? err.message : err) };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      isError: Boolean(data && data.error)
    };
  };
}

/** Create and configure the MCP server. Caller attaches a transport and calls connect(). */
export function createServer() {
  const server = new McpServer(
    { name: 'ai-price-index', version: pkg.version },
    { instructions: INSTRUCTIONS }
  );

  server.registerTool(
    'current_price',
    {
      title: 'Current price',
      description:
        "Today's input and output price per million tokens (usd_per_mtok) for a model id, with the " +
        'first-party source. Accepts short or aliased ids (e.g. "claude-opus-4-8", "gpt-4o", ' +
        '"gemini-2.5-pro"). Pass provider to disambiguate a bare id shared across vendors.',
      inputSchema: {
        model: z.string().describe('Model id or alias, e.g. "claude-opus-4-8" or "gpt-4o".'),
        provider: z
          .string()
          .optional()
          .describe('Optional provider slug (e.g. "openai", "anthropic") to disambiguate a bare id.')
      }
    },
    asTool(currentPrice)
  );

  server.registerTool(
    'price_on',
    {
      title: 'Price on a date',
      description:
        'The input and output price per million tokens that was IN EFFECT on a given date ' +
        '(YYYY-MM-DD), with the source that proves it. This is the point-in-time lookup: use it to ' +
        'value past usage or to see how a price changed over time. covered=false means the date ' +
        "predates the model's recorded coverage.",
      inputSchema: {
        model: z.string().describe('Model id or alias, e.g. "gpt-4".'),
        date: z.string().describe('The date to price, as YYYY-MM-DD, e.g. "2024-01-01".'),
        provider: z.string().optional().describe('Optional provider slug to disambiguate a bare id.')
      }
    },
    asTool(priceOnDate)
  );

  server.registerTool(
    'compare',
    {
      title: 'Compare models',
      description:
        'Side-by-side input/output prices for several model ids on one date (today by default, or ' +
        'pass date as YYYY-MM-DD). Each row resolves independently; unknown ids are reported per row.',
      inputSchema: {
        models: z
          .array(z.string())
          .min(1)
          .describe('Model ids or aliases to compare, e.g. ["claude-opus-4-8", "gpt-4o", "gemini-2.5-pro"].'),
        date: z
          .string()
          .optional()
          .describe('Optional date (YYYY-MM-DD). Omit for today.')
      }
    },
    asTool(compare)
  );

  server.registerTool(
    'cost_from_usage',
    {
      title: 'Cost from token usage',
      description:
        'Value a token rollup in USD at a point in time, using the shared cache multipliers (cache ' +
        'read 0.1x input, cache write 1.25x for 5m / 2x for 1h). tokens accepts input, output, ' +
        'cache_read, cache_write_5m, cache_write_1h. Defaults to today if no date is given.',
      inputSchema: {
        model: z.string().describe('Model id or alias to price the usage against.'),
        tokens: z
          .object({
            input: z.number().nonnegative().optional(),
            output: z.number().nonnegative().optional(),
            cache_read: z.number().nonnegative().optional(),
            cache_write_5m: z.number().nonnegative().optional(),
            cache_write_1h: z.number().nonnegative().optional()
          })
          .describe('Token counts to value. All fields optional and non-negative; missing fields count as 0.'),
        date: z.string().optional().describe('Optional date (YYYY-MM-DD). Omit for today.'),
        provider: z.string().optional().describe('Optional provider slug to disambiguate a bare id.')
      }
    },
    asTool(costFromUsage)
  );

  server.registerTool(
    'list_models',
    {
      title: 'List models',
      description:
        'List the model ids known to the dataset, optionally filtered to one provider, each with its ' +
        'provider and aliases. Use this to discover valid ids for the other tools.',
      inputSchema: {
        provider: z
          .string()
          .optional()
          .describe('Optional provider slug to filter by, e.g. "anthropic".')
      }
    },
    asTool(listModels)
  );

  return server;
}
