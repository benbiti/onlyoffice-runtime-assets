# Runtime Assets Governance

## Ownership model

This repository is the source of truth for runtime assets and governance
artifacts.

Owned in this repository:
- `scripts/sync-onlyoffice-assets.mjs`
- `scripts/hash-onlyoffice-assets.mjs`
- `scripts/prune-onlyoffice-assets.mjs`
- `scripts/verify-onlyoffice-assets.mjs`
- runtime asset governance docs and workflow

Owned in the main app repository:
- ONLYOFFICE runtime integration code
- stale lock cleanup command surface
- index style docs that link back to this repository

## Branch and CI policy

- Governance checks run on push events for branch `runtime-en`.
- Any runtime asset update must pass prune, hash, and verify checks before
  publishing a new submodule pointer in the main repository.
