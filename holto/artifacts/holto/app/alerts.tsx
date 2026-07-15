import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";
import { govUkAdviceUrl } from "@/utils/govAdvice";
import { COUNTRIES, findCountry, type Country } from "@/constants/countries";

type Level = "low" | "moderate" | "high" | "extreme";
interface Advisory {
  code: string;
  name: string | null;
  score: number;
  level: Level;
  label: string;
  message: string | null;
  source: string | null;
  updated: string | null;
  elevated?: boolean;
}

const LEVEL: Record<Level, { color: string; emoji: string }> = {
  low: { color: "#2E7D52", emoji: "🟢" },
  moderate: { color: "#C9A24B", emoji: "🟡" },
  high: { color: "#D97706", emoji: "🟠" },
  extreme: { color: "#C0392B", emoji: "🔴" },
};

function CountryPicker({ visible, onSelect, onClose }: { visible: boolean; onSelect: (c: Country) => void; onClose: () => void }) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [query]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Check a country</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <View style={[styles.searchWrap, { borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search a country" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} autoCorrect={false} />
          </View>
          <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
            {filtered.map((c) => (
              <Pressable key={c.code} onPress={() => { onSelect(c); onClose(); setQuery(""); }} style={[styles.cityRow, { borderBottomColor: colors.border }]}>
                <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                <Text style={[styles.cityRowLabel, { color: colors.foreground }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const [country, setCountry] = useState<Country | null>(null);
  const [picking, setPicking] = useState(false);

  const detail = useQuery<{ available: boolean; advisory?: Advisory }>({
    queryKey: ["advisory", country?.code],
    queryFn: () => customFetch(`/api/advisory/${country!.code}`, { responseType: "json" }),
    enabled: !!country,
    retry: false,
  });

  const watchlist = useQuery<{ destinations: { code: string; name: string }[] }>({
    queryKey: ["watchlist"],
    queryFn: () => customFetch("/api/watchlist", { responseType: "json" }),
    retry: false,
  });
  const codes = (watchlist.data?.destinations ?? []).map((d) => d.code);

  const glance = useQuery<{ results: { code: string; advisory: Advisory | null }[] }>({
    queryKey: ["advisories", codes.join(",")],
    queryFn: () => customFetch(`/api/advisories?codes=${codes.join(",")}`, { responseType: "json" }),
    enabled: codes.length > 0,
    retry: false,
  });

  const adv = detail.data?.available ? detail.data.advisory : undefined;
  const lvl = adv ? LEVEL[adv.level] : null;
  const nameFor = (code: string) => findCountry(code)?.name ?? code;
  const flagFor = (code: string) => findCountry(code)?.flag ?? "🏳️";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Travel alerts</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Live government safety advisories for any country — updated from official sources.
        </Text>
      </Animated.View>

      <Pressable onPress={() => setPicking(true)} style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>Country</Text>
        <View style={styles.pickValueRow}>
          <Text style={[styles.pickValue, { color: country ? colors.foreground : colors.mutedForeground }]}>{country ? `${country.flag}  ${country.name}` : "Choose a country"}</Text>
          <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>

      {country && detail.isFetching ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : null}

      {country && !detail.isFetching ? (
        adv && lvl ? (
          <Animated.View entering={FadeInDown.duration(360)} style={[styles.card, colors.shadow, { backgroundColor: colors.card, borderColor: lvl.color, borderRadius: colors.radius }]}>
            <View style={styles.cardTop}>
              <Text style={{ fontSize: 26 }}>{lvl.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardCountry, { color: colors.foreground }]}>{country.name}</Text>
                <Text style={[styles.cardLevel, { color: lvl.color }]}>{adv.label}</Text>
              </View>
            </View>
            {adv.elevated ? (
              <Text style={[styles.elevatedNote, { color: lvl.color }]}>⚠️ Raised by HOLTO's safety review — an active conflict or serious government warning applies here.</Text>
            ) : null}
            {adv.message ? <Text style={[styles.cardMsg, { color: colors.mutedForeground }]} numberOfLines={4}>{adv.message}</Text> : null}
            <Pressable onPress={() => openUrl(govUkAdviceUrl(country.code, country.name))} style={[styles.linkRow, { borderColor: colors.border }]}>
              <Icon name="globe" size={15} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.foreground }]}>Official advice (UK Foreign Office)</Text>
              <Icon name="chevron-right" size={15} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {adv.source ? `Source: ${adv.source}` : "Aggregated government advisories"}{adv.updated ? ` · updated ${adv.updated.slice(0, 10)}` : ""}
            </Text>
          </Animated.View>
        ) : (
          <View style={[styles.info, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              No live advisory for {country.name} right now. Check the official advice below.
            </Text>
            <Pressable onPress={() => openUrl(govUkAdviceUrl(country.code, country.name))} style={[styles.linkRow, { borderColor: colors.border }]}>
              <Icon name="globe" size={15} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.foreground }]}>Official advice (UK Foreign Office)</Text>
              <Icon name="chevron-right" size={15} color={colors.mutedForeground} />
            </Pressable>
          </View>
        )
      ) : null}

      {codes.length > 0 ? (
        <View style={{ marginTop: 28 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>YOUR WATCHLIST</Text>
          {glance.isFetching && !glance.data ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
          ) : (
            (glance.data?.results ?? []).map((r) => {
              const l = r.advisory ? LEVEL[r.advisory.level] : null;
              return (
                <Pressable
                  key={r.code}
                  onPress={() => setCountry(findCountry(r.code) ?? null)}
                  style={[styles.glanceRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
                >
                  <Text style={{ fontSize: 20 }}>{flagFor(r.code)}</Text>
                  <Text style={[styles.glanceName, { color: colors.foreground }]}>{nameFor(r.code)}</Text>
                  {l && r.advisory ? (
                    <View style={[styles.glanceBadge, { backgroundColor: l.color + "22" }]}>
                      <Text style={[styles.glanceBadgeText, { color: l.color }]}>{r.advisory.label}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.glanceNa, { color: colors.mutedForeground }]}>—</Text>
                  )}
                  <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}

      <View style={[styles.disclaimer, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
        <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
          ⚠️ Advisory levels are aggregated from government sources and can lag events. Always read your own government's official advice before you travel.
        </Text>
      </View>

      <CountryPicker visible={picking} onSelect={setCountry} onClose={() => setPicking(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  pickBtn: { borderWidth: 1, padding: 16, marginTop: 18 },
  pickLabel: { fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  pickValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  pickValue: { fontFamily: "Inter_700Bold", fontSize: 18, flex: 1 },
  card: { borderWidth: 1.5, padding: 18, marginTop: 18, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardCountry: { fontFamily: "Inter_700Bold", fontSize: 17 },
  cardLevel: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginTop: 1 },
  cardMsg: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  elevatedNote: { fontFamily: "Inter_600SemiBold", fontSize: 13, lineHeight: 19 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  linkText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 11 },
  info: { borderWidth: 1, padding: 18, marginTop: 18, gap: 12 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  glanceRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 8 },
  glanceName: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  glanceBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  glanceBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  glanceNa: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  disclaimer: { padding: 14, marginTop: 22 },
  disclaimerText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  cityRowLabel: { fontFamily: "Inter_500Medium", fontSize: 15 },
});
