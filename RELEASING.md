# Releasing

This package publishes to npm from CI with build provenance. Tests run on every push and pull request
(`.github/workflows/ci.yml`); pushing a version tag publishes (`.github/workflows/release.yml`).

## One-time setup (founder)

A CI publish needs an npm automation token, because the account's 2FA is a hardware security key and CI
cannot complete the browser challenge. Automation tokens are allowed to bypass 2FA.

1. On npmjs.com: Account -> Access Tokens -> Generate New Token -> **Automation** (or a Granular token
   scoped to publish `ai-price-index-mcp`).
2. In this repo: Settings -> Secrets and variables -> Actions -> New repository secret named **`NPM_TOKEN`**.

Alternative, no stored token: configure a **Trusted Publisher** for this package on npmjs.com pointing at
`RoninForge/ai-price-index-mcp` and the `release.yml` workflow, then drop `NODE_AUTH_TOKEN` from the
workflow. More secure, but needs the npm CLI on the runner at version 11.5 or newer.

## Cutting a release

From a clean `main`:

```bash
npm version patch            # or: minor / major  (bumps package.json, makes a vX.Y.Z commit + tag)
git push origin main --follow-tags
```

The tag push runs `release.yml`: it installs, runs the full test suite (in-memory + real-subprocess
stdio e2e), checks the tag matches `package.json`, then runs `npm publish --provenance --access public`.
The published version carries a provenance attestation linking it to this repo and commit.

If `NPM_TOKEN` is not set, the workflow fails fast with a clear message before publishing.

## Shipping newer prices

Price data comes from the pinned `ai-price-index` dependency (bundled inline, no runtime network).
Dependabot opens a PR when a newer `ai-price-index` is published. Merge it, confirm CI is green, then cut
a release as above. The new release reports the newer dataset `data_version` in every result.
