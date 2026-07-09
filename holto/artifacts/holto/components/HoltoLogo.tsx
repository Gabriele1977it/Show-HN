import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

const LOGO_IMAGE = require("@/assets/images/holto-logo.png");

interface Props {
  size?: "small" | "medium" | "large";
  inverted?: boolean;
}

const SIZES = {
  small: { w: 88, h: 29, text: 21, dot: 6 },
  medium: { w: 130, h: 43, text: 31, dot: 8 },
  large: { w: 180, h: 60, text: 44, dot: 11 },
};

export function HoltoLogo({ size = "medium", inverted = false }: Props) {
  const colors = useColors();
  const s = SIZES[size];

  if (inverted) {
    return (
      <View style={styles.container}>
        <Text
          style={[
            styles.wordmark,
            {
              fontSize: s.text,
              color: "#F4F7F8",
              letterSpacing: s.text * 0.18,
            },
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

  return (
    <Image
      source={LOGO_IMAGE}
      style={{ width: s.w, height: s.h }}
      resizeMode="contain"
      accessibilityLabel="HOLTO"
    />
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
