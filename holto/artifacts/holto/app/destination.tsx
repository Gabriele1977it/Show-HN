import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { track } from "@/utils/analytics";
import {
  ESSENTIALS_LIST,
  findEssentials,
  type CountryEssentials,
  type WaterSafety,
} from "@/constants/countryEssentials";

interface EsimPackage {
  id: string;
  operator: string;
  title: string;
  data: string;
  days: number | null;
  price: number | null;
  currency: string;
}

const WATER_META: Record<WaterSafety, { label: string; color: string; emoji: string }> = {
  safe: { label: "Tap water is safe to drink", color: "#2E7D52", emoji: "💧" },
  bottled: { label: "Bottled water recommended", color: "#C9A24B", emoji: "🚰" },
  caution: { label: "Drink bottled or filtered water only", color: "#C0392B", emoji: "⚠️" },
};

interface AdvisoryResp {
  available: boolean;
  advisory?: { code: string; score: number; level: "low" | "moderate" | "high" | "extreme"; label: string; message: string | null; source: string | null; updated: string | null };
}
const ADVISORY_COLOR: Record<string, string> = { low: "#2E7D52", moderate: "#C9A24B", high: "#E67E22", extreme: "#C0392B" };

function AdvisoryBanner({ code, colors }: { code: string; colors: ReturnType<typeof useColors> }) {
  const { data } = useQuery<AdvisoryResp>({
    queryKey: ["advisory", code],
    queryFn: () => customFetch<AdvisoryResp>(`/api/advisory/${code}`, { responseType: "json" }),
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
  if (!data?.available || !data.advisory) return null;
  const a = data.advisory;
  const color = ADVISORY_COLOR[a.level] ?? colors.mutedForeground;
  return (
    <View style={[styles.advisory, { backgroundColor: color + "18", borderColor: color + "55" }]}>
      <View style={[styles.advisoryDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.advisoryLabel, { color }]}>Travel advisory · {a.label}</Text>
        {a.updated ? <Text style={[styles.advisoryMeta, { color: colors.mutedForeground }]}>Aggregated from official sources · updated {a.updated}</Text> : null}
      </View>
    </View>
  );
}

function firstNumber(s: string): string | null {
  const m = s.match(/\d{3,}/) ?? s.match(/\d+/);
  return m ? m[0] : null;
}

function Row({ emoji, label, value, colors }: { emoji: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

export default function DestinationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ country?: string }>();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const initial = typeof params.country === "string" ? findEssentials(params.country) : null;
  const [selected, setSelected] = useState<CountryEssentials | null>(initial);
  const [query, setQuery] = useState("");
  const qc = useQueryClient();

  const { data: watchlist } = useQuery<{ destinations: { code: string }[] }>({
    queryKey: ["watchlist"],
    queryFn: () => customFetch<{ destinations: { code: string }[] }>("/api/watchlist", { responseType: "json" }),
    retry: false,
  });

  const { data: esim } = useQuery<{ configured: boolean; packages: EsimPackage[] }>({
    queryKey: ["esim", selected?.code],
    queryFn: () => customFetch<{ configured: boolean; packages: EsimPackage[] }>(`/api/esim/packages?country=${selected!.code}`, { responseType: "json" }),
    enabled: !!selected?.code,
    retry: false,
    staleTime: 30 * 60 * 1000,
  });
  const esimPackages = esim?.configured ? esim.packages : [];
  const savedCodes = new Set((watchlist?.destinations ?? []).map((d) => d.code));

  const toggleSave = useMutation({
    mutationFn: async (c: CountryEssentials) => {
      if (savedCodes.has(c.code)) {
        await customFetch(`/api/watchlist/${c.code}`, { method: "DELETE" });
      } else {
        await customFetch("/api/watchlist", { method: "POST", body: JSON.stringify({ code: c.code, name: c.name }), responseType: "json" });
        track("watchlist_add");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ESSENTIALS_LIST.filter((c) => c.name.toLowerCase().includes(q)) : ESSENTIALS_LIST;
  }, [query]);

  // ── Picker view ──────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.h1, { color: colors.foreground }]}>Destination guide</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            The essentials the moment you land — emergency numbers, plugs, tap water, money and local know-how. Works offline.
          </Text>
          <Pressable onPress={() => router.push("/watchlist" as never)} style={styles.watchLink} hitSlop={6}>
            <Icon name="star" size={14} color={colors.primary} />
            <Text style={[styles.watchLinkText, { color: colors.primary }]}>Your watchlist</Text>
          </Pressable>
        </Animated.View>

        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 18 }]}>
          <Icon name="search" size={16} color={colors.mutedForeground} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search a country" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} />
        </View>

        <View style={{ marginTop: 14 }}>
          {filtered.map((c) => (
            <Pressable key={c.code} onPress={() => { setSelected(c); setQuery(""); }} style={({ pressed }) => [styles.pickRow, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
              <Text style={styles.pickFlag}>{c.flag}</Text>
              <Text style={[styles.pickName, { color: colors.foreground }]}>{c.name}</Text>
              <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ── Briefing view ────────────────────────────────────────────────────────
  const c = selected;
  const water = WATER_META[c.tapWater];
  const dial = firstNumber(c.emergency);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Pressable onPress={() => setSelected(null)} hitSlop={8} style={styles.changeRow}>
          <Icon name="arrow-left" size={15} color={colors.primary} />
          <Text style={[styles.changeText, { color: colors.primary }]}>Change country</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={[styles.country, { color: colors.foreground }]}>{c.flag} {c.name}</Text>
          <Pressable
            onPress={() => toggleSave.mutate(c)}
            hitSlop={8}
            style={[styles.saveBtn, { borderColor: savedCodes.has(c.code) ? colors.primary : colors.border, backgroundColor: savedCodes.has(c.code) ? colors.primary : "transparent" }]}
          >
            <Icon name="star" size={14} color={savedCodes.has(c.code) ? colors.primaryForeground : colors.mutedForeground} />
            <Text style={[styles.saveText, { color: savedCodes.has(c.code) ? colors.primaryForeground : colors.mutedForeground }]}>
              {savedCodes.has(c.code) ? "Saved" : "Save"}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      <AdvisoryBanner code={c.code} colors={colors} />

      {/* Emergency — most important, tappable */}
      <Animated.View entering={FadeInDown.delay(40).duration(400)}>
        <Pressable
          onPress={() => dial && Linking.openURL(`tel:${dial}`)}
          style={[styles.emergencyCard, colors.shadow, { backgroundColor: "#C0392B", borderRadius: colors.radius }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyLabel}>EMERGENCY</Text>
            <Text style={styles.emergencyValue}>{c.emergency}</Text>
          </View>
          {dial ? (
            <View style={styles.callBadge}>
              <Icon name="radio" size={16} color="#C0392B" />
              <Text style={styles.callText}>Call {dial}</Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>

      {/* Fast facts */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={[styles.card, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Row emoji="🔌" label="Power" value={`${c.plugs} · ${c.voltage}`} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row emoji="🚗" label="Driving" value={c.drivingSide === "left" ? "Drives on the LEFT" : "Drives on the RIGHT"} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row emoji="📞" label="Dialing code" value={c.dialingCode} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <Text style={styles.rowEmoji}>{water.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Water</Text>
            <Text style={[styles.rowValue, { color: water.color }]}>{water.label}</Text>
          </View>
        </View>
      </Animated.View>

      {/* Money — links into our tools */}
      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={[styles.card, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Row emoji="💰" label="Currency" value={c.currency} colors={colors} />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <Pressable onPress={() => router.push(`/currency?to=${c.currency}` as never)} style={[styles.linkBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.linkBtnText, { color: colors.primaryForeground }]}>Convert £ → {c.currency}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/cost-of-living" as never)} style={[styles.linkBtnGhost, { borderColor: colors.border }]}>
            <Text style={[styles.linkBtnGhostText, { color: colors.foreground }]}>Cost of living</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Tipping + tip */}
      <Animated.View entering={FadeInDown.delay(160).duration(400)} style={[styles.card, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Row emoji="🪙" label="Tipping" value={c.tipping} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Row emoji="💡" label="Good to know" value={c.tip} colors={colors} />
      </Animated.View>

      {esimPackages.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={[styles.card, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={styles.esimHead}>
            <Text style={{ fontSize: 20 }}>📶</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.esimTitle, { color: colors.foreground }]}>Stay connected in {c.name}</Text>
              <Text style={[styles.esimSub, { color: colors.mutedForeground }]}>Prepaid eSIM data — install before you land, no roaming bills.</Text>
            </View>
          </View>
          {esimPackages.slice(0, 4).map((p) => (
            <View key={p.id} style={[styles.esimRow, { borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.esimData, { color: colors.foreground }]}>{p.data}{p.days ? ` · ${p.days} days` : ""}</Text>
                <Text style={[styles.esimOp, { color: colors.mutedForeground }]}>{p.operator}</Text>
              </View>
              {p.price != null ? (
                <Text style={[styles.esimPrice, { color: colors.primary }]}>
                  {p.currency === "GBP" ? "£" : p.currency === "USD" ? "$" : ""}{p.price.toFixed(2)}{p.currency !== "GBP" && p.currency !== "USD" ? ` ${p.currency}` : ""}
                </Text>
              ) : null}
            </View>
          ))}
          <Text style={[styles.esimNote, { color: colors.mutedForeground }]}>Powered by Airalo · in-app purchase coming soon.</Text>
        </Animated.View>
      ) : null}

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Guidance for travellers — always confirm emergency numbers and local rules on the ground.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  pickFlag: { fontSize: 22 },
  pickName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 8 },
  changeText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  country: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3, flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  saveBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  saveText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  watchLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  watchLinkText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  esimHead: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  esimTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  esimSub: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginTop: 2 },
  esimRow: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingTop: 12, marginTop: 12 },
  esimData: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  esimOp: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  esimPrice: { fontFamily: "Inter_700Bold", fontSize: 16 },
  esimNote: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 12 },
  advisory: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
  advisoryDot: { width: 9, height: 9, borderRadius: 5 },
  advisoryLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  advisoryMeta: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  emergencyCard: { flexDirection: "row", alignItems: "center", padding: 18, marginTop: 16 },
  emergencyLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1.4, color: "rgba(255,255,255,0.8)" },
  emergencyValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff", marginTop: 3 },
  callBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  callText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#C0392B" },
  card: { borderWidth: 1, padding: 16, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  rowEmoji: { fontSize: 20, width: 26, textAlign: "center" },
  rowLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  rowValue: { fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 21, marginTop: 1 },
  divider: { height: 1, marginVertical: 10 },
  linkBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  linkBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  linkBtnGhost: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  linkBtnGhostText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 18 },
});
