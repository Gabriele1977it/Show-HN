import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { SkeletonCard } from "@/components/Skeleton";
import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";

type Category = "world" | "travel";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
  category: Category;
}

const FILTERS: { key: "all" | Category; label: string }[] = [
  { key: "all", label: "Top stories" },
  { key: "world", label: "World" },
  { key: "travel", label: "Travel" },
];

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function NewsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const [filter, setFilter] = useState<"all" | Category>("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["news"],
    queryFn: () => customFetch<{ items: NewsItem[] }>("/api/news?limit=60"),
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(() => {
    const all = data?.items ?? [];
    return filter === "all" ? all : all.filter((i) => i.category === filter);
  }, [data, filter]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>STAY IN THE KNOW</Text>
        <Text style={[styles.h1, { color: colors.foreground }]}>Live news</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          World headlines and travel updates, refreshed through the day. Tap any story to read the full article.
        </Text>
      </Animated.View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : "transparent" },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={{ marginTop: 8 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 30 }}>📰</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn't load the news</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Pull to refresh, or check back in a moment.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { backgroundColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 30 }}>🗞️</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>No stories right now — pull to refresh.</Text>
        </View>
      ) : (
        items.map((item, i) => (
          <Animated.View key={item.link} entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(360)}>
            <Pressable
              onPress={() => openUrl(item.link)}
              style={({ pressed }) => [
                styles.card,
                colors.shadow,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.99 : 1 }] },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.metaRow}>
                  <View style={[styles.tag, { backgroundColor: colors.primary + "14" }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>{item.category === "travel" ? "TRAVEL" : "WORLD"}</Text>
                  </View>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.source}
                    {timeAgo(item.publishedAt) ? ` · ${timeAgo(item.publishedAt)}` : ""}
                  </Text>
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          </Animated.View>
        ))
      )}

      <Text style={[styles.foot, { color: colors.mutedForeground }]}>
        Headlines from independent public news feeds. HOLTO doesn't edit or rank them — tap through to read at the source.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  h1: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, marginTop: 6 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 18, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 16, marginBottom: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.5 },
  meta: { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 21 },
  empty: { alignItems: "center", borderWidth: 1, padding: 28, marginTop: 10, gap: 10 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, textAlign: "center" },
  retry: { marginTop: 6, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  foot: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 16 },
});
