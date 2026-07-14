import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { SkeletonCard } from "@/components/Skeleton";
import { useColors } from "@/hooks/useColors";

interface EsimOrderRow {
  id: number;
  country: string;
  packageTitle: string;
  dataLabel: string | null;
  days: number | null;
  status: string;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  fulfilled: { label: "Ready", color: "#2E7D52" },
  pending: { label: "Processing", color: "#C9A24B" },
  failed: { label: "Issue", color: "#C0392B" },
};

export default function EsimsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const { data, isLoading } = useQuery<{ orders: EsimOrderRow[] }>({
    queryKey: ["esim-orders"],
    queryFn: () => customFetch<{ orders: EsimOrderRow[] }>("/api/esim/orders", { responseType: "json" }),
    retry: false,
  });
  const orders = data?.orders ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>My eSIMs</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Your data plans and how to install them.</Text>
      </Animated.View>

      {isLoading ? (
        <View style={{ marginTop: 20 }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : orders.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 32 }}>📶</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No eSIMs yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Open a destination guide to grab a prepaid data plan — install it before you fly, no roaming bills.
          </Text>
          <Pressable onPress={() => router.push("/destination" as never)} style={[styles.cta, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Browse destinations</Text>
          </Pressable>
        </View>
      ) : (
        orders.map((o, i) => {
          const meta = STATUS_META[o.status] ?? STATUS_META.pending;
          return (
            <Animated.View key={o.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(360)}>
              <Pressable
                onPress={() => router.push(`/esim/${o.id}` as never)}
                style={({ pressed }) => [styles.row, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
              >
                <Text style={{ fontSize: 24 }}>📶</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>{o.dataLabel ?? o.packageTitle}{o.days ? ` · ${o.days} days` : ""}</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{o.country} eSIM</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: meta.color + "22" }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            </Animated.View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 16, marginTop: 12 },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  empty: { alignItems: "center", borderWidth: 1, padding: 28, marginTop: 20, gap: 10 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  cta: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
