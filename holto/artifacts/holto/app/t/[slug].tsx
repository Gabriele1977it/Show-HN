import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HoltoLogo } from "@/components/HoltoLogo";
import { Icon, type IconName } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";
import { downloadRecapCard, recapCardSupported } from "@/utils/recapCard";

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
interface Creator {
  name: string | null;
  youtube: string | null;
  instagram: string | null;
  code: string | null;
}
interface PublicTrip {
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  recap: Recap;
  spendGBP: number | null;
  highlights: Highlight[];
  creator?: Creator | null;
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

  // Set the page title + Open Graph tags on web so a shared link shows a rich
  // preview (title, summary) instead of the bare app shell. Restored on unmount.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !data) return;
    const prevTitle = document.title;
    document.title = `${data.title} · HOLTO trip recap`;
    const places = data.recap.countries || data.recap.places;
    const desc = `${data.recap.days != null ? `${data.recap.days} days` : "A trip"}${places ? `, ${places} place${places === 1 ? "" : "s"}` : ""}${data.recap.flights ? `, ${data.recap.flights} flight${data.recap.flights === 1 ? "" : "s"}` : ""} — planned with HOLTO.`;
    const setMeta = (key: string, attr: "name" | "property", value: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };
    setMeta("description", "name", desc);
    setMeta("og:title", "property", `${data.title} · HOLTO`);
    setMeta("og:description", "property", desc);
    setMeta("og:type", "property", "article");
    return () => {
      document.title = prevTitle;
    };
  }, [data]);

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

  const shareUrl =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.href
      : `https://app.holtotravel.com/t/${slug}`;

  async function shareTrip() {
    const message = `${data!.title} — my trip recap on HOLTO`;
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as Navigator & { share?: unknown }).share) {
        await (navigator as unknown as { share: (d: object) => Promise<void> }).share({ title: data!.title, text: message, url: shareUrl });
      } else if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        await Share.share({ message: `${message}\n${shareUrl}`, url: shareUrl, title: data!.title });
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  function openExternal(url: string) {
    openUrl(url);
  }
  function downloadCard() {
    void downloadRecapCard({
      title: data!.title,
      destination: data!.destination,
      days: data!.recap.days,
      countries: data!.recap.countries,
      places: data!.recap.places,
      flights: data!.recap.flights,
      spendGBP: data!.spendGBP,
      cities: data!.recap.cities,
      creatorName: data!.creator?.name ?? null,
    });
  }
  function openSignup(code: string | null) {
    if (code) router.push({ pathname: "/(auth)/register", params: { ref: code } } as never);
    else router.replace("/");
  }

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

        <View style={styles.heroBtnRow}>
          <Pressable onPress={shareTrip} style={styles.shareBtn}>
            <Icon name="share-2" size={15} color="#0A2E38" />
            <Text style={styles.shareText}>Share this trip</Text>
          </Pressable>
          {recapCardSupported() ? (
            <Pressable onPress={downloadCard} style={styles.cardBtn}>
              <Text style={styles.cardBtnText}>📸 Story card</Text>
            </Pressable>
          ) : null}
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

      {/* Creator follow card */}
      {data.creator ? (
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={[styles.creatorCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.creatorAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.creatorInitial}>{(data.creator.name ?? "?").trim().charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[styles.creatorName, { color: colors.foreground }]}>{data.creator.name ?? "This creator"}</Text>
            <Text style={[styles.creatorSub, { color: colors.mutedForeground }]}>Follow along for more trips & tips</Text>
            <View style={styles.creatorLinks}>
              {data.creator.youtube ? (
                <Pressable onPress={() => openExternal(data.creator!.youtube!)} style={[styles.creatorLink, { backgroundColor: "#FF0000" }]}>
                  <Text style={styles.creatorLinkText}>YouTube</Text>
                </Pressable>
              ) : null}
              {data.creator.instagram ? (
                <Pressable onPress={() => openExternal(data.creator!.instagram!)} style={[styles.creatorLink, { backgroundColor: "#C13584" }]}>
                  <Text style={styles.creatorLinkText}>Instagram</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* Viral CTA */}
      <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
        <View style={[styles.ctaCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.ctaTitle, { color: colors.foreground }]}>
            {data.creator?.code ? `${data.creator.name ?? "This creator"} plans with HOLTO` : "Planned with HOLTO"}
          </Text>
          <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>
            {data.creator?.code
              ? "Your honest travel companion — flight tracking, disruption help, trips & more. Sign up with this link for 30 days of Pro, free."
              : "Your honest travel companion — live flight tracking, disruption help, trips, expenses and more. Free to start."}
          </Text>
          <Pressable onPress={() => openSignup(data.creator?.code ?? null)} style={[styles.ctaBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
              {data.creator?.code ? "Get 30 days Pro — free" : "Plan your own trip — free"}
            </Text>
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
  creatorCard: { borderWidth: 1, padding: 20, alignItems: "center" },
  creatorAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  creatorInitial: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  creatorName: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 10 },
  creatorSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  creatorLinks: { flexDirection: "row", gap: 10, marginTop: 14 },
  creatorLink: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
  creatorLinkText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#fff" },
  heroBtnRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 22 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#F2C94C", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  shareText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#0A2E38" },
  cardBtn: { alignItems: "center", justifyContent: "center", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  cardBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
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
