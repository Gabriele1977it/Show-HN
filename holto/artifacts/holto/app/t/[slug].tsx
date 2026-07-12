import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HoltoLogo } from "@/components/HoltoLogo";
import { Icon, type IconName } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

interface Recap {
  days: number | null;
  flights: number;
  stays: number;
  activities: number;
  places: number;
  countries: number;
  cities: string[];
}
interface Highlight {
  type: string;
  title: string;
  location: string | null;
  startAt: string | null;
}
interface PublicTrip {
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  recap: Recap;
  spendGBP: number | null;
  highlights: Highlight[];
}

const TYPE_ICON: Record<string, IconName> = {
  flight: "send" as IconName,
  hotel: "home" as IconName,
  train: "navigation" as IconName,
  car: "navigation" as IconName,
  activity: "star" as IconName,
  other: "map-pin" as IconName,
};

function dateRange(start: string | null, end: string | null): string {
  const fmt = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  return "";
}
function itemTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function PublicTripScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const topPad = Platform.OS === "web" ? 28 : insets.top + 12;
  const bottomPad = Platform.OS === "web" ? 48 : insets.bottom + 32;

  const { data, isLoading, isError } = useQuery<PublicTrip>({
    queryKey: ["public-trip", slug],
    queryFn: () => customFetch<PublicTrip>(`/api/public/trips/${slug}`, { responseType: "json" }),
    retry: false,
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 28 }]}>
        <HoltoLogo size="medium" />
        <Text style={[styles.notFound, { color: colors.foreground }]}>This trip isn't shared</Text>
        <Text style={[styles.notFoundSub, { color: colors.mutedForeground }]}>
          The link may be private or no longer available.
        </Text>
        <Pressable onPress={() => router.replace("/")} style={[styles.ctaBtn, { backgroundColor: colors.primary, marginTop: 18 }]}>
          <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>Discover HOLTO</Text>
        </Pressable>
      </View>
    );
  }

  const r = data.recap;
  const placeStat = r.countries > 0 ? { value: r.countries, label: r.countries === 1 ? "country" : "countries" } : { value: r.places, label: r.places === 1 ? "place" : "places" };
  const stats: { value: string; label: string }[] = [];
  if (r.days != null) stats.push({ value: String(r.days), label: r.days === 1 ? "day" : "days" });
  if (placeStat.value > 0) stats.push({ value: String(placeStat.value), label: placeStat.label });
  if (r.flights > 0) stats.push({ value: String(r.flights), label: r.flights === 1 ? "flight" : "flights" });
  if (data.spendGBP != null) stats.push({ value: `£${data.spendGBP.toLocaleString("en-GB")}`, label: "spent" });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient colors={["#0A2E38", "#0E3F50"]} style={[styles.hero, { paddingTop: topPad }]}>
        <View style={styles.heroLogo}><HoltoLogo size="small" inverted /></View>
        <Text style={styles.heroEyebrow}>TRIP RECAP</Text>
        <Text style={styles.heroTitle}>{data.title}</Text>
        {data.destination ? <Text style={styles.heroDest}>{data.destination}</Text> : null}
        {dateRange(data.startDate, data.endDate) ? (
          <Text style={styles.heroDates}>{dateRange(data.startDate, data.endDate)}</Text>
        ) : null}

        <View style={styles.statRow}>
          {stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 ? <View style={styles.statDivider} /> : null}
              <View style={styles.stat}>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      {/* Timeline */}
      {data.highlights.length > 0 ? (
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>The journey</Text>
          {data.highlights.map((h, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(40 + i * 30).duration(360)} style={styles.hlRow}>
              <View style={[styles.hlIcon, { backgroundColor: colors.muted }]}>
                <Icon name={TYPE_ICON[h.type] ?? ("map-pin" as IconName)} size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hlTitle, { color: colors.foreground }]} numberOfLines={1}>{h.title}</Text>
                {(h.location || itemTime(h.startAt)) ? (
                  <Text style={[styles.hlMeta, { color: colors.mutedForeground }]}>
                    {[h.location, itemTime(h.startAt)].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* Viral CTA */}
      <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
        <View style={[styles.ctaCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Planned with HOLTO</Text>
          <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>
            Your honest travel companion — live flight tracking, disruption help, trips, expenses and more. Free to start.
          </Text>
          <Pressable onPress={() => router.replace("/")} style={[styles.ctaBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>Plan your own trip — free</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { paddingHorizontal: 24, paddingBottom: 28, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroLogo: { marginBottom: 22 },
  heroEyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.6, color: "rgba(255,255,255,0.5)" },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 30, color: "#fff", letterSpacing: -0.5, marginTop: 6 },
  heroDest: { fontFamily: "Inter_500Medium", fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  heroDates: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  statRow: { flexDirection: "row", alignItems: "center", marginTop: 24, flexWrap: "wrap" },
  stat: { alignItems: "center", paddingHorizontal: 6 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 26, color: "#fff", letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  statDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 10 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 14 },
  hlRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  hlIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  hlTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  hlMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  ctaCard: { borderWidth: 1, padding: 20, alignItems: "flex-start" },
  ctaTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  ctaSub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 16 },
  ctaBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, alignSelf: "stretch" },
  ctaBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  notFound: { fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 20 },
  notFoundSub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 6 },
});
