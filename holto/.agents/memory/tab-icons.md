---
name: Tab icons reliability
description: How to reliably render tab bar icons in Expo Go on physical iOS/Android devices
---

## Rule
Use `SymbolView` from `expo-symbols` on iOS (system SF Symbols, zero font loading needed) with a `fallback` prop pointing to a Feather icon for Android/web. Load Feather via the official `...Feather.font` spread in `useFonts`, not via a manually keyed local TTF file.

## Working pattern
```tsx
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';

function TabIcon({ sfSymbol, featherName, color, size }) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView name={sfSymbol} size={size} tintColor={color}
        fallback={<Feather name={featherName} size={size} color={color} />} />
    );
  }
  return <Feather name={featherName} size={size} color={color} />;
}
```

## Valid SF Symbol names used in HOLTO
- Home: `house.fill`
- My Flight: `airplane.departure`
- Plans: `star.fill`
- Rights: `shield.fill`
- Living: `globe`
- Account: `person.circle.fill`

## Font loading (useFonts in _layout.tsx)
```ts
useFonts({ ...Feather.font, Inter_400Regular, ... })
```
Do NOT use `Feather: require("../assets/fonts/Feather.ttf")` — the manual local-key approach was tried and failed silently on physical devices.

**Why:** SF Symbols are built into iOS and never need font loading. The `...Feather.font` spread references `@expo/vector-icons`'s own bundled TTF via the correct internal key, which Metro resolves reliably. A manually keyed local copy competes with the library's internal registration and can cause silent failures.

**Previous failed approaches (do not retry):**
1. NativeTabs from expo-router/unstable-native-tabs — unstable API, unreliable in Expo Go
2. SymbolView alone with wrong SF Symbol names like "scale.3d" — that symbol does not exist; always verify names
3. Manual `Feather: require("../assets/fonts/Feather.ttf")` in useFonts — failed silently on physical devices
