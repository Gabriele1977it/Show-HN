import { Icon } from "@/components/Icon";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  message: string;
  proactiveHint?: string | null;
}

export function CompanionBanner({ message, proactiveHint }: Props) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.midnight,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.row}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: "rgba(63,181,196,0.2)",
              borderRadius: 8,
            },
          ]}
        >
          <Icon name="shield" size={15} color={colors.aqua} />
        </View>
        <Text style={[styles.message, { color: "rgba(244,247,248,0.92)" }]}>
          {message}
        </Text>
      </View>
      {!!proactiveHint && (
        <View
          style={[
            styles.hint,
            { borderTopColor: "rgba(255,255,255,0.08)" },
          ]}
        >
          <Icon
            name="star"
            size={12}
            color={colors.gold}
            style={{ marginTop: 1 }}
          />
          <Text style={[styles.hintText, { color: "rgba(201,162,75,0.9)" }]}>
            {proactiveHint}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  icon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
  },
  hint: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
});
