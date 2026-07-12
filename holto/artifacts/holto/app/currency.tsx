import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { CURRENCIES, CURRENCY_BY_CODE, type Currency } from "@/constants/currencies";
import { useColors } from "@/hooks/useColors";

interface RatesResponse {
  base: string;
  rates: Record<string, number>; // units per GBP
  fetchedAt: string | null;
}

// Convert `amount` from → to via the GBP pivot. null if a rate is missing.
function convert(amount: number, from: string, to: string, ratesPerGBP: Record<string, number>): number | null {
  const rf = from === "GBP" ? 1 : ratesPerGBP[from];
  const rt = to === "GBP" ? 1 : ratesPerGBP[to];
  if (!rf || !rt) return null;
  return (amount / rf) * rt;
}

function fmt(n: number): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const POPULAR = ["GBP", "EUR", "USD", "EGP", "AED", "THB", "JPY", "TRY"];

function CurrencyPicker({ visible, onSelect, onClose }: { visible: boolean; onSelect: (c: Currency) => void; onClose: () => void }) {
  const colors = useColors();
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? CURRENCIES.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)) : CURRENCIES;
  }, [q]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Currency</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={colors.mutedForeground} autoFocus style={[styles.searchInput, { color: colors.foreground }]} />
          </View>
          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            {filtered.map((c) => (
              <Pressable key={c.code} onPress={() => { onSelect(c); onClose(); setQ(""); }} style={[styles.curRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.curCode, { color: colors.foreground }]}>{c.symbol}  {c.code}</Text>
                <Text style={[styles.curName, { color: colors.mutedForeground }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CurrencyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const params = useLocalSearchParams<{ to?: string; from?: string }>();
  const initialTo =
    (typeof params.to === "string" && CURRENCY_BY_CODE[params.to.toUpperCase()]) || CURRENCY_BY_CODE.EUR!;
  const initialFrom =
    (typeof params.from === "string" && CURRENCY_BY_CODE[params.from.toUpperCase()]) || CURRENCY_BY_CODE.GBP!;

  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState<Currency>(initialFrom);
  const [to, setTo] = useState<Currency>(initialTo);
  const [picking, setPicking] = useState<null | "from" | "to">(null);

  const { data, isLoading, isError } = useQuery<RatesResponse>({
    queryKey: ["fx-rates"],
    queryFn: () => customFetch<RatesResponse>("/api/fx/rates", { responseType: "json" }),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
  const rates = data?.rates ?? {};

  const amt = parseFloat(amount) || 0;
  const result = data ? convert(amt, from.code, to.code, rates) : null;
  const unitRate = data ? convert(1, from.code, to.code, rates) : null;

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Currency converter</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Live mid-market rates for 160+ currencies. Convert instantly — even offline once loaded.
        </Text>
      </Animated.View>

      {/* Amount + From */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={[styles.card, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Amount</Text>
        <View style={styles.amountRow}>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.amountInput, { color: colors.foreground }]}
          />
          <Pressable onPress={() => setPicking("from")} style={[styles.curBtn, { backgroundColor: colors.muted }]}>
            <Text style={[styles.curBtnText, { color: colors.foreground }]}>{from.symbol} {from.code}</Text>
            <Icon name="chevron-down" size={15} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Swap */}
      <View style={styles.swapWrap}>
        <Pressable onPress={swap} style={[styles.swapBtn, colors.shadow, { backgroundColor: colors.primary }]} accessibilityLabel="Swap currencies">
          <Icon name="refresh-cw" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {/* Result + To */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.card, colors.shadow, { backgroundColor: colors.midnight, borderRadius: colors.radius }]}>
        <Text style={styles.resultLabel}>Converts to</Text>
        <View style={styles.amountRow}>
          <Text style={styles.resultValue} numberOfLines={1} adjustsFontSizeToFit>
            {isLoading ? "…" : result != null ? fmt(result) : "—"}
          </Text>
          <Pressable onPress={() => setPicking("to")} style={[styles.curBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Text style={[styles.curBtnText, { color: "#fff" }]}>{to.symbol} {to.code}</Text>
            <Icon name="chevron-down" size={15} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
        {unitRate != null ? (
          <Text style={styles.rateLine}>1 {from.code} = {fmt(unitRate)} {to.code}</Text>
        ) : null}
      </Animated.View>

      {isError ? (
        <Text style={[styles.note, { color: colors.destructive }]}>Couldn't load rates. Check your connection and try again.</Text>
      ) : result == null && !isLoading && data ? (
        <Text style={[styles.note, { color: colors.mutedForeground }]}>One of these currencies isn't in the live feed right now.</Text>
      ) : null}

      {/* Popular quick-pick for the "to" side */}
      <Animated.View entering={FadeInDown.delay(140).duration(400)} style={{ marginTop: 22 }}>
        <Text style={[styles.quickLabel, { color: colors.mutedForeground }]}>QUICK CONVERT TO</Text>
        <View style={styles.quickRow}>
          {POPULAR.filter((c) => c !== to.code && CURRENCY_BY_CODE[c]).map((code) => {
            const r = data ? convert(amt, from.code, code, rates) : null;
            return (
              <Pressable key={code} onPress={() => setTo(CURRENCY_BY_CODE[code]!)} style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.quickCode, { color: colors.foreground }]}>{code}</Text>
                <Text style={[styles.quickVal, { color: colors.mutedForeground }]}>{r != null ? fmt(r) : "—"}</Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        {data?.fetchedAt
          ? `Mid-market rates, updated ${new Date(data.fetchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Cards and ATMs add a margin — treat these as a guide.`
          : "Mid-market rates for reference. Cards and ATMs add a margin."}
      </Text>

      <CurrencyPicker
        visible={picking !== null}
        onSelect={(c) => (picking === "from" ? setFrom(c) : setTo(c))}
        onClose={() => setPicking(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  card: { borderWidth: 1, padding: 18, marginTop: 18 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  amountInput: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 34, letterSpacing: -0.5, padding: 0 },
  curBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  curBtnText: { fontFamily: "Inter_700Bold", fontSize: 15 },
  swapWrap: { alignItems: "center", marginVertical: -14, zIndex: 2 },
  swapBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  resultLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginBottom: 8 },
  resultValue: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 34, letterSpacing: -0.5, color: "#fff" },
  rateLine: { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 14 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 18 },
  quickLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minWidth: 90 },
  quickCode: { fontFamily: "Inter_700Bold", fontSize: 13 },
  quickVal: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  curRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1 },
  curCode: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  curName: { fontFamily: "Inter_400Regular", fontSize: 13 },
});
