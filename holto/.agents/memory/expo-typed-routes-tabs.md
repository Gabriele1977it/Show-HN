---
name: Expo typed routes tab path
description: Correct path string for navigating to the tabs group root in expo-router typed routes.
---

Use `"/(tabs)"` not `"/(tabs)/"` when calling `router.replace(...)` or `<Redirect href="..." />`.

The trailing slash triggers TS2345 because the generated typed route union does not include it.

**Why:** expo-router's typed routes generator produces `"/(tabs)"` as the canonical form for the tabs group index. The trailing slash variant is not in the union type.

**How to apply:** Any time you navigate to the tabs root (post-login redirect, logout recovery), use `router.replace("/(tabs)")` or `<Redirect href="/(tabs)" />`.
