import { Icon } from "@/components/Icon";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  message?: string;
  onRetry?: () => void;
}

export function RetryError({
  message = "Couldn't load this right now.",
  onRetry,
}: Props) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <Icon name="wifi-off" size={28} color={colors.mutedForeground} />
      <Text style={[styles.message, { color: colors.mutedForeground }]}>
        {message}
      </Text>
      {onRetry && (
        <Pressable
          style={({ pressed }) => [
            styles.retryBtn,
            {
              borderColor: colors.border,
              borderRadius: colors.radius / 2,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={onRetry}
        >
          <Icon name="refresh-cw" size={14} color={colors.foreground} />
          <Text style={[styles.retryText, { color: colors.foreground }]}>
            Try again
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  retryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
