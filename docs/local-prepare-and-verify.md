# Local Prepare and Verify

Use this flow when updating ONLYOFFICE runtime assets in this repository.

## 1) Sync assets from upstream source

```bash
node scripts/sync-onlyoffice-assets.mjs \
  --source-root /path/to/upstream/vendor \
  --asset-root .
```

## 2) Rebuild integrity manifest

```bash
node scripts/hash-onlyoffice-assets.mjs --asset-root .
```

## 3) Prune untracked or stale files

```bash
node scripts/prune-onlyoffice-assets.mjs --asset-root . --dry-run
node scripts/prune-onlyoffice-assets.mjs --asset-root .
```

## 4) Verify runtime package constraints

```bash
node scripts/verify-onlyoffice-assets.mjs --asset-root . --en-only
```

## 5) Commit and publish

- Commit script and asset changes in this repository first.
- Update the submodule gitlink in the main app repository after approval.
