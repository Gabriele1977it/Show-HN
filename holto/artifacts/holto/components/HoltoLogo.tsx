import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  size?: "small" | "medium" | "large";
  // Force the light-on-dark treatment (e.g. on a dark gradient) regardless of
  // the active theme.
  inverted?: boolean;
}

const SIZES = {
  small: { text: 21, dot: 6 },
  medium: { text: 31, dot: 8 },
  large: { text: 44, dot: 11 },
};

// The HOLTO wordmark. Rendered as text so it's crisp at any size and adapts to
// light/dark: dark brand ink on light backgrounds, off-white on dark ones, with
// a gold accent dot.
export function HoltoLogo({ size = "medium", inverted = false }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const s = SIZES[size];

  const onDark = inverted || scheme === "dark";
  const textColor = onDark ? "#F4F7F8" : colors.midnight;

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.wordmark,
          { fontSize: s.text, color: textColor, letterSpacing: s.text * 0.18 },
        ]}
      >
        HOLTO
      </Text>
      <View
        style={[
          styles.dot,
          {
            width: s.dot,
            height: s.dot,
            borderRadius: s.dot / 2,
            backgroundColor: colors.gold,
            marginLeft: s.dot / 2,
            marginBottom: s.dot * 0.3,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  wordmark: {
    fontFamily: "Inter_600SemiBold",
  },
  dot: {},
});
