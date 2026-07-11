// HOLTO design tokens.
//
// `useColors()` returns the palette for the active appearance (light/dark)
// merged with scheme-independent tokens (radius, spacing, shadow). Brand
// colors (midnight/teal/aqua/gold) are intentionally identical across
// schemes so gradients and branded cards look the same in both.
const colors = {
  light: {
    text: "#0A2E38",
    tint: "#1C7C8C",

    background: "#F4F7F8",
    foreground: "#0A2E38",

    card: "#FFFFFF",
    cardForeground: "#0A2E38",

    primary: "#1C7C8C",
    primaryForeground: "#FFFFFF",

    secondary: "#3FB5C4",
    secondaryForeground: "#FFFFFF",

    muted: "#E8EEF0",
    mutedForeground: "#6B8A94",

    accent: "#C9A24B",
    accentForeground: "#FFFFFF",

    destructive: "#C94040",
    destructiveForeground: "#FFFFFF",

    border: "#D0DDE0",
    input: "#D0DDE0",

    // Subtle elevation for cards.
    shadowColor: "#0A2E38",
    shadowOpacity: 0.08,

    midnight: "#0A2E38",
    teal: "#1C7C8C",
    aqua: "#3FB5C4",
    gold: "#C9A24B",
    offWhite: "#F4F7F8",
  },
  dark: {
    text: "#E6EEF0",
    tint: "#3FB5C4",

    background: "#071A20",
    foreground: "#E6EEF0",

    card: "#0E2A32",
    cardForeground: "#E6EEF0",

    primary: "#3FB5C4",
    primaryForeground: "#04252C",

    secondary: "#2E9BAC",
    secondaryForeground: "#04252C",

    muted: "#12323B",
    mutedForeground: "#8FB0B8",

    accent: "#D4B25E",
    accentForeground: "#04252C",

    destructive: "#E5695F",
    destructiveForeground: "#FFFFFF",

    border: "#1B3B44",
    input: "#1B3B44",

    shadowColor: "#000000",
    shadowOpacity: 0.4,

    midnight: "#0A2E38",
    teal: "#1C7C8C",
    aqua: "#3FB5C4",
    gold: "#C9A24B",
    offWhite: "#F4F7F8",
  },
  radius: 12,
};

export default colors;
