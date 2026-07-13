import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { SkeletonCard } from "@/components/Skeleton";
import { findEssentials } from "@/constants/countryEssentials";
import { useColors } from "@/hooks/useColors";

interface SavedDestination {
  id: number;
  code: string;
  name: string;
}
interface Advisory {
  level: "low" | "moderate" | "high" | "extreme";
  label: string;
}

const LEVEL_COLOR: Record<Advisory["level"], string> = {
  low: "#2E7D52",
  moderate: "#C9A24B",
  high: "#D98324",
  extreme: "#C0392B",
};

function AdvisoryBadge({ code }: { code: string }) {
  const colors = useColors();
  const { data } = useQuery<{ advisory?: Advisory | null } | Advisory | null>({
    queryKey: ["advisory", code],
    queryFn: () => customFetch(`/api/advisory/${code}`, { responseType: "json" }),
    retry: false,
    staleTime: 12 * 60 * 60 * 1000,
  });
  const adv = (data && "advisory" in (data as object) ? (data as { advisory?: Advisory | null }).advisory : (data as Advisory | null)) ?? null;
  if (!adv) return null;
  const color = LEVEL_COLOR[adv.level] ?? colors.mutedForeground;
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>{adv.label}</Text>
    </View>
  );
}

export default function WatchlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const { data, isLoading } = useQuery<{ destinations: SavedDestination[] }>({
    queryKey: ["watchlist"],
    queryFn: () => customFetch<{ destinations: SavedDestination[] }>("/api/watchlist", { responseType: "json" }),
    retry: false,
  });
  const destinations = data?.destinations ?? [];

  const remove = useMutation({
    mutationFn: (code: string) => customFetch(`/api/watchlist/${code}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Watchlist</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Destinations you're keeping an eye on — with the latest safety advisory. Tap one for the full guide.
        </Text>
      </Animated.View>

      {isLoading ? (
        <View style={{ marginTop: 20 }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : destinations.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 32 }}>⭐️</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No saved destinations yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Open a destination guide and tap Save to keep it here with its live safety advisory.
          </Text>
          <Pressable onPress={() => router.push("/destination" as never)} style={[styles.cta, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Browse destinations</Text>
          </Pressable>
        </View>
      ) : (
        destinations.map((d, i) => {
          const ess = findEssentials(d.code);
          return (
            <Animated.View key={d.id} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(360)}>
              <Pressable
                onPress={() => router.push(`/destination?country=${encodeURIComponent(d.code)}` as never)}
                style={({ pressed }) => [styles.row, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.99 : 1 }] }]}
              >
                <Text style={{ fontSize: 26 }}>{ess?.flag ?? "📍"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{d.name}</Text>
                  <AdvisoryBadge code={d.code} />
                </View>
                <Pressable onPress={() => remove.mutate(d.code)} hitSlop={10} style={{ padding: 4 }}>
                  <Icon name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
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
  name: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  empty: { alignItems: "center", borderWidth: 1, padding: 28, marginTop: 20, gap: 10 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  cta: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
