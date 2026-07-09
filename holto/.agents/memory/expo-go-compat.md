---
name: Expo Go incompatible packages
description: Packages that crash in Expo Go and must be removed or replaced
---

react-native-keyboard-controller requires a dev build (native module linking). Its bindings.native.ts explicitly prints "- You are not using Expo Go" in the error. Its animated.tsx also imports react-native-is-edge-to-edge which is a peer dep that wasn't installed.

**Why:** KeyboardProvider wraps the entire app root in _layout.tsx — any crash there takes down the whole app before any screen renders.

**How to apply:** Remove KeyboardProvider from _layout.tsx and replace KeyboardAwareScrollView usage with plain ScrollView from react-native. The keyboard improvements are nice-to-have but the app must work in Expo Go first.
