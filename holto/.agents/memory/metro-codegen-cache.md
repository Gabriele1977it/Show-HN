---
name: Metro stale cache after codegen
description: Expo Metro blanks after running orval codegen with clean:true — restart workflow to fix.
---

When orval runs with `clean: true`, it deletes and recreates the generated directory. If Metro is watching files at that moment, it may cache a "file not found" state and serve a blank screen even after the files return.

**Fix:** Restart the `artifacts/holto: expo` workflow. Metro will re-bundle from scratch and resolve everything correctly.

**Why:** Metro watches the filesystem and caches resolution results. The brief absence of generated files during the `clean` phase poisons the cache. A workflow restart clears Metro's in-memory cache and forces a full re-bundle.

**How to apply:** Any time you run `pnpm --filter @workspace/api-spec run codegen` and the Expo app goes blank, restart the holto workflow — do not add special Metro config or workarounds.
