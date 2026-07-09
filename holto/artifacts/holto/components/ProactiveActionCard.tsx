import { Icon } from "@/components/Icon";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface ProactiveAction {
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  why: string;
}

interface Props {
  action: ProactiveAction;
}

export function ProactiveActionCard({ action }: Props) {
  const colors = useColors();

  const urgencyIcon =
    action.urgency === "high" ? "alert-circle" : action.urgency === "medium" ? "clock" : "info";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: "#EAF5F7",
          borderColor: colors.teal,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.midnight, borderRadius: 4 },
          ]}
        >
          <Text style={styles.badgeText}>Do this first</Text>
        </View>
        <Icon
          name={urgencyIcon as string}
          size={14}
          color={colors.teal}
        />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>
        {action.title}
      </Text>

      <Text style={[styles.description, { color: colors.foreground }]}>
        {action.description}
      </Text>

      <View style={[styles.whyRow, { borderTopColor: "rgba(28,124,140,0.15)" }]}>
        <Icon name="book-open" size={11} color={colors.mutedForeground} />
        <Text style={[styles.why, { color: colors.mutedForeground }]}>
          {action.why}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "#F4F7F8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 8,
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 12,
  },
  whyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  why: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
});
