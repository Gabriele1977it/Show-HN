import { Icon } from "@/components/Icon";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Tier } from "@/constants/tiers";
import { useSubscription } from "@/hooks/useSubscription";

interface Props {
  requiredTier: "trip_pass" | "pro";
  feature: string;
  children: React.ReactNode;
}

const TIER_ORDER: Record<Tier, number> = { free: 0, trip_pass: 1, pro: 2 };

export default function PaywallGate({ requiredTier, feature, children }: Props) {
  const colors = useColors();
  const { tier, isLoading } = useSubscription();

  if (isLoading) return <>{children}</>;

  const hasAccess = TIER_ORDER[tier] >= TIER_ORDER[requiredTier];
  if (hasAccess) return <>{children}</>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "22" }]}>
          <Icon name="lock" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{feature}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {requiredTier === "trip_pass"
            ? "Available on Trip Pass (7 days) or Holto Pro"
            : "Available on Holto Pro"}
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => router.push("/(tabs)/account" as never)}
        >
          <Text style={styles.btnText}>See plans</Text>
          <Icon name="arrow-right" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  btn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
