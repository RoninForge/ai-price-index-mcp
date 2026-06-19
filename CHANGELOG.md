# Changelog

## 0.1.1 (2026-06-19)

- CI publish-on-tag workflow with npm build provenance (`.github/workflows/release.yml`); see RELEASING.md.
- Dependabot keeps the `ai-price-index` data dependency, the MCP SDK, and the workflow actions current.
- Dockerfile so MCP hosts (for example Glama) can build and run the stdio server for introspection.
- LICENSE cleaned to a standard MIT file so GitHub and downstream indexers detect it.

## 0.1.0 (2026-06-19)

Initial release. Read-only, zero-key MCP server (stdio) wrapping the `ai-price-index` library.

- Tools: `current_price`, `price_on`, `compare`, `cost_from_usage`, `list_models`.
- Point-in-time price lookups with first-party source, `last_validated`, and `confidence` on every
  result, plus the CC BY 4.0 attribution and the dataset DOI for citation.
- Token counts for `cost_from_usage` are validated non-negative, with a finite-value guard.
- Built on `@modelcontextprotocol/sdk` 1.29 with `StdioServerTransport`.
- Failed lookups and unexpected handler errors are surfaced as MCP tool errors (`isError: true`) so a
  client can tell a miss from a hit, while still returning the structured explanation.
- In-memory client/server smoke test plus a real-subprocess stdio e2e (all five tools and an error path
  over raw JSON-RPC) under `test/`; `npm test` runs both, and GitHub Actions CI runs them on Node 18,
  20, and 22.

Published to npm as `ai-price-index-mcp@0.1.0` on 2026-06-19 (manual publish, no provenance attestation).
Future tagged releases publish from CI with provenance. Not yet listed in any registry.
