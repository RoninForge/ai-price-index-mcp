# ai-price-index-mcp

A read-only, zero-key [Model Context Protocol](https://modelcontextprotocol.io) server that lets a
coding agent (Claude Code, Cursor, and any other MCP client) query the open
[AI Price Index](https://roninforge.org/data/ai-price-index/): dated, first-party-sourced AI model
API prices.

Most pricing tools tell an agent what a model costs **today**. This one also answers what a model
cost **on a given date**, and returns the first-party source URL plus the date that price was last
validated, so the agent can cite the number. That point-in-time lookup is the differentiator.

- **Zero keys, zero prompts, zero network at runtime.** The dated dataset is bundled inline inside the
  `ai-price-index` dependency. The server reads it locally and adds nothing to your traffic.
- **Read-only.** It only looks prices up. It cannot write, configure, or call out.
- **Cite-ready.** Every result carries `source_url`, `last_validated`, `confidence`, and the CC BY 4.0
  attribution string.

## Install

Requires Node.js 18 or newer. No build step, no API key.

```bash
npx -y ai-price-index-mcp
```

That command runs the stdio server; an MCP client launches it for you using the config below.

## Client configuration

Drop this into your MCP client config. The server speaks stdio.

Claude Code (`~/.claude.json` or a project `.mcp.json`), and Cursor (`~/.cursor/mcp.json`), use the
same `mcpServers` shape:

```json
{
  "mcpServers": {
    "ai-price-index": {
      "command": "npx",
      "args": ["-y", "ai-price-index-mcp"]
    }
  }
}
```

Or, with Claude Code's CLI:

```bash
claude mcp add ai-price-index -- npx -y ai-price-index-mcp
```

## Tools

All tools return structured JSON as text content. Prices are `usd_per_mtok` (USD per million tokens).
Model ids resolve through the dataset's aliases, so short ids work (e.g. `claude-opus-4-5` resolves to
`claude-opus-4-5-20251101`).

| Tool | Arguments | Returns |
| --- | --- | --- |
| `current_price` | `model`, `provider?` | Today's input/output price for a model, with its source. |
| `price_on` | `model`, `date` (YYYY-MM-DD), `provider?` | The price **in effect on that date** (the point-in-time lookup). |
| `compare` | `models[]`, `date?` | Side-by-side input/output prices for several models on one date. |
| `cost_from_usage` | `model`, `tokens`, `date?`, `provider?` | USD value of a token rollup at a point in time, with cache multipliers. |
| `list_models` | `provider?` | Known model ids (optionally one provider), each with its aliases. |

`tokens` for `cost_from_usage` accepts `input`, `output`, `cache_read`, `cache_write_5m`,
`cache_write_1h` (all optional, missing counts as 0). Cache read is 0.1x input, cache write is 1.25x
(5 minute) or 2x (1 hour).

Pass `provider` (for example `openai`, `anthropic`, `google`) to disambiguate a bare id that exists
under more than one vendor.

### Example result

`price_on` with `{ "model": "gpt-4", "date": "2024-01-01" }`:

```json
{
  "query": "gpt-4",
  "provider": "openai",
  "model": "gpt-4",
  "date": "2024-01-01",
  "covered": true,
  "input": {
    "usd_per_mtok": 30,
    "unit": "usd_per_mtok",
    "effective_from": "2023-03-14",
    "effective_to": null,
    "last_validated": "2023-04-15",
    "confidence": "archived",
    "source_url": "https://web.archive.org/web/20230415223802/https://openai.com/pricing"
  },
  "output": { "usd_per_mtok": 60, "...": "..." },
  "provenance": {
    "dataset": "AI Price Index by RoninForge",
    "data_version": "2026-06-17",
    "license": "CC-BY-4.0",
    "attribution": "AI Price Index by RoninForge (https://roninforge.org/data/ai-price-index/), CC BY 4.0",
    "source": "https://roninforge.org/data/ai-price-index/"
  }
}
```

## How it works

This server is a thin wrapper over the [`ai-price-index`](https://www.npmjs.com/package/ai-price-index)
npm library, which ships the dated dataset bundled inline. There is no pricing logic, no separate data
layer, and no network call here. The data version a result reports is the dataset release that the
installed `ai-price-index` pins to. To move to newer prices, update that dependency.

## Data license and attribution

The price data is from the AI Price Index and is licensed **CC BY 4.0**. When you publish anything
derived from it, attribute it:

> AI Price Index by RoninForge (https://roninforge.org/data/ai-price-index/), CC BY 4.0.

The code of this server is licensed MIT (see [LICENSE](LICENSE)). Data and tooling licenses are
tracked upstream in the [ai-price-index](https://github.com/RoninForge/ai-price-index) repository.

## Links

- Data page: https://roninforge.org/data/ai-price-index/
- Library: https://www.npmjs.com/package/ai-price-index
- Dataset repo: https://github.com/RoninForge/ai-price-index
- DOI: https://doi.org/10.5281/zenodo.20730241
