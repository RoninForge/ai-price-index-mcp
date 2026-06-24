# Registry listing prep (do NOT submit yet)

Targets the founder can submit to LATER, after review and after the package is published to npm and
(optionally) moved to its own repo. Nothing here is submitted by the build. Honest positioning only:
lead with open data, point-in-time, and zero-key. No "AI" hype, no cold outreach, no scraping.

## One-line description (reuse verbatim)

> Read-only, zero-key MCP server for the open AI Price Index: look up dated, first-party-sourced AI
> model API prices, including what a model cost on a past date.

## Short description (for fields that allow a sentence or two)

> An MCP server that gives coding agents read-only, zero-key access to the AI Price Index, an open
> (CC BY 4.0) dataset of dated, first-party-sourced AI model API prices. Unlike current-only price
> tools, it answers point-in-time queries (what a model cost on a given date) and returns the source
> URL and last-validated date with every price so the agent can cite it. No keys, no prompts, no
> network at runtime; the dated dataset is bundled inline.

## Tools to list

- `current_price` - today's input/output price per million tokens for a model id, with source.
- `price_on` - the price in effect on a YYYY-MM-DD date (the point-in-time differentiator).
- `compare` - side-by-side prices for several models on one date.
- `cost_from_usage` - USD value of a token rollup at a point in time, with cache multipliers.
- `list_models` - known model ids, optionally per provider, with aliases.

## Official MCP Registry - AUTOMATED (no submission needed)

The official MCP Registry (registry.modelcontextprotocol.io) is wired up: `server.json` (repo root) is
published by `.github/workflows/publish-mcp.yml` on every `v*` tag via GitHub OIDC, under the name
`io.github.RoninForge/ai-price-index-mcp`. No form, no token, no founder step. It goes live on the next
tagged release; see RELEASING.md ("Official MCP Registry") for the trust model and how to re-run it.
This is the upstream source many of the directories below ingest from, so it lands first by design.

## Submission targets (in suggested order)

1. **awesome-mcp-servers** (https://github.com/punkpeye/awesome-mcp-servers) - PR adding one line under
   the relevant category (data / finance / developer tools). One-issue-at-a-time; follow the repo's
   contribution rules. This is the anchor listing most other indexes scrape from.
2. **Glama MCP directory** (https://glama.ai/mcp/servers) - submit the server; it auto-indexes public
   GitHub repos with an MCP server, so it mostly needs the repo public + a clean README.
3. **Smithery** (https://smithery.ai) - add the server; supports stdio. Provide the npx command and the
   tool list. Check whether a `smithery.yaml` is wanted before submitting.
4. **PulseMCP** (https://www.pulsemcp.com) - submit via their add-a-server flow with the one-liner.
5. **best-of-mcp-servers** / "best of" aggregators - PR or submission once the awesome-list entry lands,
   since several of these mirror it.

## Pre-submission checklist (founder gate)

- [ ] Package published to npm as `ai-price-index-mcp` (verify the bin works via `npx -y ai-price-index-mcp`).
- [ ] Decide the home repo: keep under the RoninForge.org monorepo `tools/` dir, or split into a
      dedicated public `RoninForge/ai-price-index-mcp` repo (most directories expect a standalone repo).
- [ ] README install + client-config snippet verified against a fresh Claude Code and Cursor install.
- [ ] Confirm `name: "ai-price-index-mcp"` is free on npm before first publish.
- [ ] Honest-positioning pass: no "AI" hype in any listing copy, attribution string present.
