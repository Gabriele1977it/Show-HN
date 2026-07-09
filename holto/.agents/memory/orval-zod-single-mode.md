---
name: Orval zod single-mode config
description: How to configure orval's zod client output without export conflicts in the api-zod lib.
---

Use `mode: "single"` with `target: "generated/api.ts"` (a `.ts` file path, not a directory).
Do NOT include a `schemas` key alongside the zod client output — it generates TypeScript interfaces with the same names as Zod schemas, causing duplicate export errors.

`lib/api-zod/src/index.ts` is a **manually maintained** file with a single line:
```ts
export * from "./generated/api";
```
Orval does not regenerate it in single-mode. Never add other exports — they will create conflicts if old generated paths are referenced.

**Why:** The default `mode: "split"` + `schemas` option generates both Zod schemas and TypeScript interfaces under different paths but re-exports both from the same barrel, causing TS2300 duplicate identifier errors.

**How to apply:** After any orval config change that touches output paths, verify `lib/api-zod/src/index.ts` only exports from the new target path, then run `pnpm --filter @workspace/api-spec run codegen` and confirm typecheck:libs passes.
