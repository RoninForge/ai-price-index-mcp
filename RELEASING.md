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

## Shipping newer prices

Price data comes from the pinned `ai-price-index` dependency (bundled inline, no runtime network).
Dependabot opens a PR when a newer `ai-price-index` is published. Merge it, confirm CI is green, then cut
a release as above. The new release reports the newer dataset `data_version` in every result.
