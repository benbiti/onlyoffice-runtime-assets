# Runtime Asset Security Checklist

Use this checklist before shipping a new runtime asset revision.

- [ ] Run `node scripts/sync-onlyoffice-assets.mjs --source-root <dir> --asset-root .`
- [ ] Run `node scripts/hash-onlyoffice-assets.mjs --asset-root .`
- [ ] Run `node scripts/prune-onlyoffice-assets.mjs --asset-root . --dry-run`
- [ ] Run `node scripts/verify-onlyoffice-assets.mjs --asset-root . --en-only`
- [ ] Review manifest diff in `wasm-integrity-manifest.json`
- [ ] Ensure push-based governance workflow passes on `runtime-en`
- [ ] Update main repository submodule pointer only after checks pass
