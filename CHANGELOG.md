# Changelog

## 0.1.0 (unreleased)

Initial build. Read-only, zero-key MCP server (stdio) wrapping the `ai-price-index` library.

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

Not published. Not listed in any registry. Pending founder review.
