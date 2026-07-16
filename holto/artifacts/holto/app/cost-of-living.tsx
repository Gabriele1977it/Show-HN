import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

interface CityOpt { code: string; label: string; country: string }
interface Budget {
  rent: number; utilities: number; groceries: number; dining: number; transport: number; gym: number; monthlyTotal: number;
}
interface CityBudget { code: string; label: string; country: string; currency: string; budget: Budget; priceIndex: number | null }
interface Comparison { a: CityBudget; b: CityBudget; dataVersion?: string; priceIndex?: { source: string; year: number; live: boolean }; cachedUntil: string }

const ROWS: { key: keyof Budget; label: string; icon: IconName; hint?: string }[] = [
  { key: "rent", label: "Rent", icon: "home" as IconName, hint: "1-bed flat" },
  { key: "utilities", label: "Utilities", icon: "zap" as IconName, hint: "+ broadband" },
  { key: "groceries", label: "Groceries", icon: "shopping-bag" as IconName },
  { key: "dining", label: "Meal out", icon: "coffee" as IconName },
  { key: "transport", label: "Transport", icon: "navigation" as IconName, hint: "monthly pass" },
  { key: "gym", label: "Gym", icon: "activity" as IconName },
];

function gbp(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function CityPickerModal({
  visible, cities, onSelect, onClose,
}: { visible: boolean; cities: CityOpt[]; onSelect: (c: CityOpt) => void; onClose: () => void }) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? cities.filter((c) => c.label.toLowerCase().includes(q) || c.country.toLowerCase().includes(q)) : cities;
  }, [cities, query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Choose a city</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <View style={[styles.searchWrap, { borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search city or country"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCorrect={false}
            />
          </View>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {filtered.map((c) => (
              <Pressable key={c.code} onPress={() => { onSelect(c); onClose(); setQuery(""); }} style={[styles.cityRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.cityRowLabel, { color: colors.foreground }]}>{c.label}</Text>
                <Text style={[styles.cityRowCountry, { color: colors.mutedForeground }]}>{c.country}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function CostOfLivingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const [a, setA] = useState("LON");
  const [b, setB] = useState("LIS");
  const [picking, setPicking] = useState<null | "a" | "b">(null);

  const { data: cities = [] } = useQuery<CityOpt[]>({
    queryKey: ["col-cities"],
    queryFn: () => customFetch<CityOpt[]>("/api/cost-of-living/cities", { responseType: "json" }),
    staleTime: 60 * 60 * 1000,
  });

  const { data, isFetching, isError } = useQuery<Comparison>({
    queryKey: ["col", a, b],
    queryFn: () => customFetch<Comparison>(`/api/cost-of-living?a=${a}&b=${b}`, { responseType: "json" }),
    enabled: !!a && !!b,
    retry: false,
  });

  const labelFor = (code: string) => cities.find((c) => c.code === code)?.label ?? code;

  const headline = useMemo(() => {
    if (!data) return null;
    const at = data.a.budget.monthlyTotal;
    const bt = data.b.budget.monthlyTotal;
    if (!at || !bt) return null;
    const pct = Math.round((1 - bt / at) * 100);
    if (pct === 0) return `${data.b.label} costs about the same as ${data.a.label}.`;
    return pct > 0
      ? `${data.b.label} is about ${pct}% cheaper than ${data.a.label}.`
      : `${data.b.label} is about ${Math.abs(pct)}% pricier than ${data.a.label}.`;
  }, [data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Cost of living</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Compare a month's essentials between two cities — all in GBP, so you can see where your money goes further.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.pickRow}>
        <Pressable onPress={() => setPicking("a")} style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>From</Text>
          <Text style={[styles.pickCity, { color: colors.foreground }]}>{labelFor(a)}</Text>
        </Pressable>
        <View style={[styles.vs, { backgroundColor: colors.muted }]}><Text style={[styles.vsText, { color: colors.mutedForeground }]}>vs</Text></View>
        <Pressable onPress={() => setPicking("b")} style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>To</Text>
          <Text style={[styles.pickCity, { color: colors.foreground }]}>{labelFor(b)}</Text>
        </Pressable>
      </Animated.View>

      {isFetching ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}

      {isError && !isFetching ? (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Couldn't load the comparison just now. Check your connection and try again.
          </Text>
        </View>
      ) : null}

      {data && !isFetching ? (
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginTop: 18 }}>
          {headline ? (
            <View style={[styles.headlineCard, colors.shadow, { backgroundColor: colors.midnight, borderRadius: colors.radius }]}>
              <Text style={styles.headlineText}>{headline}</Text>
            </View>
          ) : null}

          <View style={[styles.table, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.trHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.thLabel, { color: colors.mutedForeground }]}>Monthly</Text>
              <Text style={[styles.thCity, { color: colors.foreground }]} numberOfLines={1}>{data.a.label}</Text>
              <Text style={[styles.thCity, { color: colors.foreground }]} numberOfLines={1}>{data.b.label}</Text>
            </View>
            {ROWS.map((r) => (
              <View key={r.key} style={[styles.tr, { borderBottomColor: colors.border }]}>
                <View style={styles.tdLabelWrap}>
                  <Icon name={r.icon} size={14} color={colors.mutedForeground} />
                  <View>
                    <Text style={[styles.tdLabel, { color: colors.foreground }]}>{r.label}</Text>
                    {r.hint ? <Text style={[styles.tdHint, { color: colors.mutedForeground }]}>{r.hint}</Text> : null}
                  </View>
                </View>
                <Text style={[styles.td, { color: colors.foreground }]}>{gbp(data.a.budget[r.key])}</Text>
                <Text style={[styles.td, { color: colors.foreground }]}>{gbp(data.b.budget[r.key])}</Text>
              </View>
            ))}
            <View style={[styles.trTotal, { backgroundColor: colors.muted }]}>
              <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total / month</Text>
              <Text style={[styles.totalVal, { color: colors.primary }]}>{gbp(data.a.budget.monthlyTotal)}</Text>
              <Text style={[styles.totalVal, { color: colors.primary }]}>{gbp(data.b.budget.monthlyTotal)}</Text>
            </View>
          </View>

          {data.a.priceIndex != null && data.b.priceIndex != null ? (
            <View style={[styles.wbCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.wbTitle, { color: colors.foreground }]}>Overall price level · reality check</Text>
              <View style={styles.wbRow}>
                <Text style={[styles.wbCity, { color: colors.mutedForeground }]} numberOfLines={1}>{data.a.label}</Text>
                <Text style={[styles.wbVal, { color: colors.primary }]}>{data.a.priceIndex}</Text>
              </View>
              <View style={styles.wbRow}>
                <Text style={[styles.wbCity, { color: colors.mutedForeground }]} numberOfLines={1}>{data.b.label}</Text>
                <Text style={[styles.wbVal, { color: colors.primary }]}>{data.b.priceIndex}</Text>
              </View>
              <Text style={[styles.wbFoot, { color: colors.mutedForeground }]}>
                Country-wide index, UK = 100. Source: {data.priceIndex?.source ?? "World Bank"}
                {data.priceIndex?.year ? ` (${data.priceIndex.year})` : ""}.
              </Text>
            </View>
          ) : null}

          <Text style={[styles.note, { color: colors.mutedForeground }]}>
            The monthly breakdown is a HOLTO estimate in GBP for one person — rent is a one-bedroom flat and the total assumes ~8 meals out. The reality-check index above is real World Bank data{data.priceIndex?.year ? ` (${data.priceIndex.year})` : ""}. Actual budgets vary with lifestyle and neighbourhood.{data.dataVersion ? ` · Estimates reviewed ${data.dataVersion}.` : ""}
          </Text>
        </Animated.View>
      ) : null}

      <CityPickerModal
        visible={picking !== null}
        cities={cities}
        onSelect={(c) => (picking === "a" ? setA(c.code) : setB(c.code))}
        onClose={() => setPicking(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 },
  pickBtn: { flex: 1, borderWidth: 1, padding: 14 },
  pickLabel: { fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  pickCity: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 3 },
  vs: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  vsText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  headlineCard: { padding: 18, marginBottom: 14 },
  headlineText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: "#fff", lineHeight: 23 },
  table: { borderWidth: 1, overflow: "hidden" },
  trHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  thLabel: { flex: 1.4, fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  thCity: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "right" },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
  tdLabelWrap: { flex: 1.4, flexDirection: "row", alignItems: "center", gap: 8 },
  tdLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  tdHint: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  td: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "right" },
  trTotal: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 15 },
  totalLabel: { flex: 1.4, fontFamily: "Inter_700Bold", fontSize: 14 },
  totalVal: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 16, textAlign: "right" },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 14 },
  wbCard: { borderWidth: 1, padding: 16, marginTop: 16 },
  wbTitle: { fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 10 },
  wbRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5 },
  wbCity: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14 },
  wbVal: { fontFamily: "Inter_700Bold", fontSize: 18, marginLeft: 12 },
  wbFoot: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16, marginTop: 8 },
  infoCard: { borderWidth: 1, padding: 18, marginTop: 20 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  cityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1 },
  cityRowLabel: { fontFamily: "Inter_500Medium", fontSize: 15 },
  cityRowCountry: { fontFamily: "Inter_400Regular", fontSize: 13, textTransform: "capitalize" },
});
