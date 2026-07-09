import { Icon } from "@/components/Icon";
import { router } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Disruption {
  id: number;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  disruptionType: string;
  scheduledAt: string;
  createdAt: string;
}

interface Props {
  disruption: Disruption;
  onDelete?: (id: number) => void;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  delay: { label: "Delayed", color: "#1C7C8C", bg: "#EAF5F7" },
  cancellation: { label: "Cancelled", color: "#8B4513", bg: "#FDF3EC" },
  missed_connection: { label: "Missed Connection", color: "#5A3E8C", bg: "#F3EFFE" },
  denied_boarding: { label: "Denied Boarding", color: "#8B1A1A", bg: "#FDF0F0" },
};

export function DisruptionCard({ disruption, onDelete }: Props) {
  const colors = useColors();
  const config = TYPE_CONFIG[disruption.disruptionType] ?? {
    label: disruption.disruptionType,
    color: colors.primary,
    bg: colors.muted,
  };

  const date = new Date(disruption.createdAt);
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handleDelete = () => {
    Alert.alert(
      "Remove this record?",
      "This disruption record will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete?.(disruption.id),
        },
      ],
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      onPress={() => router.push(`/disruption/${disruption.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${config.label} — ${disruption.airline} ${disruption.flightNumber}, ${disruption.origin} to ${disruption.destination}`}
    >
      <View style={styles.header}>
        <View style={styles.routeWrap}>
          <Text style={[styles.flight, { color: colors.foreground }]} numberOfLines={1}>
            {disruption.airline} {disruption.flightNumber}
          </Text>
          <View style={styles.routeRow}>
            <Text style={[styles.airport, { color: colors.mutedForeground }]}>
              {disruption.origin || "–"}
            </Text>
            <Icon name="arrow-right" size={11} color={colors.mutedForeground} style={styles.arrowIcon} />
            <Text style={[styles.airport, { color: colors.mutedForeground }]}>
              {disruption.destination || "–"}
            </Text>
          </View>
        </View>

        <View style={[styles.badge, { backgroundColor: config.bg, borderRadius: 6 }]}>
          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>{dateStr}</Text>
        <View style={styles.footerActions}>
          {onDelete && (
            <Pressable
              onPress={handleDelete}
              hitSlop={10}
              style={[styles.deleteBtn, { backgroundColor: colors.muted }]}
              accessibilityLabel="Delete disruption"
            >
              <Icon name="trash-2" size={13} color={colors.mutedForeground} />
            </Pressable>
          )}
          <Icon name="chevron-right" size={14} color={colors.mutedForeground} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  routeWrap: { flex: 1 },
  flight: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  routeRow: { flexDirection: "row", alignItems: "center" },
  airport: { fontSize: 13, fontFamily: "Inter_400Regular" },
  arrowIcon: { marginHorizontal: 5 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  badgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  date: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
