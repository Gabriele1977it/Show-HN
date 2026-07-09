---
name: Nested Pressable on iOS
description: Pattern for touch targets nested inside other touch targets
---

On React Native iOS, a Pressable nested inside another Pressable often doesn't fire its onPress — the outer Pressable captures the touch event.

**Why:** iOS touch event propagation: the outer responder wins the gesture and the inner one's onPress never fires.

**How to apply:** Replace the outer Pressable with a plain View, then have the "content" area as one Pressable (flex:1) and any action buttons (e.g. remove X) as sibling Pressables, both direct children of the View. The flight chip in monitor.tsx was fixed this way.
