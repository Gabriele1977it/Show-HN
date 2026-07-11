import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * Falls back to the light palette when no dark key is defined in
 * constants/colors.ts (the scaffold ships light-only by default).
 * When a sibling web artifact's dark tokens are synced into a `dark`
 * key, this hook will automatically switch palettes based on the
 * device's appearance setting.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  // A themed, soft card elevation. On web this maps to box-shadow; on native
  // to iOS shadow / Android elevation. Kept subtle so it reads premium, not
  // heavy — and near-invisible in dark mode where borders do the lifting.
  const shadow = {
    shadowColor: palette.shadowColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: palette.shadowOpacity,
    shadowRadius: 10,
    elevation: 3,
  } as const;
  return { ...palette, radius: colors.radius, shadow };
}
