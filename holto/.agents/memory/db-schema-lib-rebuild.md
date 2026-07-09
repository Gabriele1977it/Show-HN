---
name: DB schema lib rebuild
description: Must run typecheck:libs after adding tables to lib/db/src/schema/ before leaf artifact typechecks will see the new exports.
---

`lib/db` is a composite TypeScript project. After adding or changing table definitions in `lib/db/src/schema/`, the declaration files need to be emitted before downstream artifacts (`api-server`, etc.) can resolve the new exports.

Run: `pnpm run typecheck:libs`

Then artifact typechecks (`pnpm --filter @workspace/api-server run typecheck`) will see the new exports.

**Why:** `tsc --build` only emits if sources have changed since the last build. Leaf packages reference the `.d.ts` output, not the source directly. Without rebuilding, the old `.d.ts` is stale and new exports are invisible, causing TS2305 "has no exported member" errors.

**How to apply:** Any time you touch `lib/db/src/schema/` (add table, rename column, add index), run `pnpm run typecheck:libs` first before checking downstream artifacts.
