# Releasing

This package publishes to npm from CI with build provenance via npm **Trusted Publishing** (GitHub OIDC,
no stored token). Tests run on every push and pull request (`.github/workflows/ci.yml`); pushing a
version tag publishes (`.github/workflows/release.yml`).

## One-time setup (founder): npm Trusted Publishing

There is NO npm token to create, store, or rotate, and it sidesteps 2FA entirely. Configure it once on
npm:

1. Open the package: https://www.npmjs.com/package/ai-price-index-mcp
2. **Settings** -> **Trusted Publishing** -> add a **GitHub Actions** publisher with:
   - Organization or user: `RoninForge`
   - Repository: `ai-price-index-mcp`
   - Workflow filename: `release.yml`
   - Environment: leave blank
3. Save.

That is all. No repo secret is needed: the workflow already requests the `id-token` permission and
upgrades npm to a version that supports OIDC publishing. (Earlier token-based publishing failed in CI
with `npm error code EOTP` because tokens that bypass 2FA are disallowed on this account; Trusted
Publishing avoids tokens entirely.)

## Cutting a release

From a clean `main`:

```bash
npm version patch            # or: minor / major  (bumps package.json, makes a vX.Y.Z commit + tag)
git push origin main --follow-tags
```

The tag push runs `release.yml`: it installs, runs the full test suite (in-memory + real-subprocess
stdio e2e), checks the tag matches `package.json`, then runs `npm publish --provenance --access public`
authenticated via OIDC. The published version carries a provenance attestation linking it to this repo
and commit.

The same tag also runs `publish-mcp.yml`, which lists the server on the official MCP Registry (below).

## Official MCP Registry

The server is listed on the official MCP Registry (registry.modelcontextprotocol.io) under the name
`io.github.RoninForge/ai-price-index-mcp`. `server.json` (repo root) is the source of truth for the
listing; `publish-mcp.yml` publishes it on every `v*` tag.

Trust model, like npm Trusted Publishing: **GitHub OIDC, no stored secret.** The registry authorises the
`io.github.RoninForge/*` namespace from the workflow's OIDC claim (so the name must keep the exact org
case, `RoninForge`), then proves package ownership by reading the `mcpName` field from the *published*
npm package. That is why:

- `package.json` carries `"mcpName": "io.github.RoninForge/ai-price-index-mcp"` (must equal the server
  name verbatim), and
- `publish-mcp.yml` waits for npm to expose the new version before publishing, then syncs `server.json`'s
  version to the tag.

There is no one-time setup and no secret to rotate. If the registry step ever fails after npm already
published (a propagation delay, a registry hiccup), re-run it on its own from the Actions tab via
**Run workflow** (`workflow_dispatch`): it reuses the version already in `package.json`, so it never
needs a fresh npm release. To bump the listing without a code change (rare), edit `server.json` and
re-run the workflow.

## Shipping newer prices

Price data comes from the pinned `ai-price-index` dependency (bundled inline, no runtime network).
Dependabot opens a PR when a newer `ai-price-index` is published. Merge it, confirm CI is green, then cut
a release as above. The new release reports the newer dataset `data_version` in every result.
