import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/components/DateField";
import { Icon } from "@/components/Icon";
import { CURRENCIES, CURRENCY_BY_CODE, type Currency } from "@/constants/currencies";
import { useColors } from "@/hooks/useColors";

type Category = "flights" | "lodging" | "meals" | "transport" | "entertainment" | "supplies" | "other";

const CATS: { key: Category; emoji: string; label: string }[] = [
  { key: "flights", emoji: "✈️", label: "Flights" },
  { key: "lodging", emoji: "🏨", label: "Lodging" },
  { key: "meals", emoji: "🍽️", label: "Meals" },
  { key: "transport", emoji: "🚕", label: "Transport" },
  { key: "entertainment", emoji: "🎫", label: "Client/Ent." },
  { key: "supplies", emoji: "🧾", label: "Supplies" },
  { key: "other", emoji: "📎", label: "Other" },
];
const CAT_META = Object.fromEntries(CATS.map((c) => [c.key, c]));

interface Expense {
  id: number;
  category: Category;
  merchant: string | null;
  amount: string;
  currency: string;
  spentOn: string;
  note: string | null;
}
interface Summary {
  totalGBP: number;
  byCategory: Record<string, number>;
  unconvertedCount: number;
  count: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fmtGBP(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

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
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {filtered.map((c) => (
              <Pressable key={c.code} onPress={() => { onSelect(c); onClose(); }} style={({ pressed }) => [styles.curRow, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}>
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

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(CURRENCY_BY_CODE.GBP!);
  const [curOpen, setCurOpen] = useState(false);
  const [category, setCategory] = useState<Category>("meals");
  const [merchant, setMerchant] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [tripId, setTripId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: tripsData } = useQuery<Array<{ id: number; title: string }>>({
    queryKey: ["trips"],
    queryFn: () => customFetch<Array<{ id: number; title: string }>>("/api/trips", { responseType: "json" }),
    retry: false,
  });
  const trips = Array.isArray(tripsData) ? tripsData : [];

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const { data } = useQuery<{ expenses: Expense[]; summary: Summary }>({
    queryKey: ["expenses"],
    queryFn: () => customFetch<{ expenses: Expense[]; summary: Summary }>("/api/expenses", { responseType: "json" }),
    retry: false,
  });
  const expenses = Array.isArray(data?.expenses) ? data!.expenses : [];
  const summary = data?.summary;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["expenses"] });

  const addExpense = useMutation({
    mutationFn: (body: object) => customFetch("/api/expenses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      setShowAdd(false);
      setAmount("");
      setMerchant("");
      setSpentOn("");
      setFormError(null);
      void invalidate();
    },
    onError: () => setFormError("Couldn't save that expense. Check the fields and try again."),
  });
  const deleteExpense = useMutation({
    mutationFn: (id: number) => customFetch(`/api/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  function submit() {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setFormError("Enter an amount greater than zero.");
    if (spentOn && !ISO_DATE.test(spentOn)) return setFormError("Date must be YYYY-MM-DD.");
    setFormError(null);
    addExpense.mutate({
      category,
      amount: amt,
      currency: currency.code,
      merchant: merchant || undefined,
      spentOn: spentOn || new Date().toISOString().slice(0, 10),
      tripId: tripId ?? undefined,
    });
  }

  async function exportCsv() {
    if (expenses.length === 0) return;
    const header = "Date,Category,Merchant,Amount,Currency,Note";
    const lines = expenses.map((e) =>
      [e.spentOn, e.category, e.merchant ?? "", e.amount, e.currency, e.note ?? ""].map((v) => csvCell(String(v))).join(","),
    );
    const csv = [header, ...lines].join("\n");
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `holto-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: csv, title: "HOLTO expenses" });
    }
  }

  const maxCat = summary ? Math.max(1, ...Object.values(summary.byCategory)) : 1;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Expenses</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Log spend in any currency; HOLTO totals it in GBP at today's rates and exports a report.
        </Text>
      </Animated.View>

      {/* Total */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={[styles.totalCard, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
        <Text style={styles.totalLabel}>Total this account</Text>
        <Text style={styles.totalValue}>{summary ? fmtGBP(summary.totalGBP) : "—"}</Text>
        <Text style={styles.totalMeta}>
          {summary ? `${summary.count} expense${summary.count === 1 ? "" : "s"}` : ""}
          {summary && summary.unconvertedCount > 0 ? ` · ${summary.unconvertedCount} in an unlisted currency` : ""}
        </Text>
      </Animated.View>

      {/* Category breakdown */}
      {summary && Object.keys(summary.byCategory).length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ marginTop: 18 }}>
          <Text style={[styles.h2, { color: colors.foreground }]}>By category</Text>
          {CATS.filter((c) => summary.byCategory[c.key]).map((c) => (
            <View key={c.key} style={styles.catRow}>
              <Text style={styles.catEmoji}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.catLabel, { color: colors.foreground }]}>{c.label}</Text>
                  <Text style={[styles.catAmt, { color: colors.foreground }]}>{fmtGBP(summary.byCategory[c.key]!)}</Text>
                </View>
                <View style={[styles.catTrack, { backgroundColor: colors.muted }]}>
                  <View style={[styles.catFill, { width: `${(summary.byCategory[c.key]! / maxCat) * 100}%`, backgroundColor: colors.primary }]} />
                </View>
              </View>
            </View>
          ))}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(140).duration(400)} style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
        <Pressable onPress={() => { setFormError(null); setShowAdd(true); }} style={[styles.solidBtn, { backgroundColor: colors.primary }]}>
          <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>＋ Add expense</Text>
        </Pressable>
        <Pressable onPress={exportCsv} disabled={expenses.length === 0} style={[styles.ghostBtn, { borderColor: colors.border, opacity: expenses.length === 0 ? 0.5 : 1 }]}>
          <Icon name="file-text" size={16} color={colors.foreground} />
          <Text style={[styles.ghostBtnText, { color: colors.foreground }]}>Export CSV</Text>
        </Pressable>
      </Animated.View>

      {/* List */}
      {expenses.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 28 }}>🧾</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No expenses yet. Add your first one above.</Text>
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={{ marginTop: 20 }}>
          <Text style={[styles.h2, { color: colors.foreground }]}>All expenses</Text>
          {expenses.map((e) => {
            const cur = CURRENCY_BY_CODE[e.currency];
            return (
              <View key={e.id} style={[styles.expRow, { borderBottomColor: colors.border }]}>
                <Text style={styles.expEmoji}>{CAT_META[e.category]?.emoji ?? "📎"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.expTitle, { color: colors.foreground }]}>{e.merchant || CAT_META[e.category]?.label || e.category}</Text>
                  <Text style={[styles.expMeta, { color: colors.mutedForeground }]}>{fmtDate(e.spentOn)}</Text>
                </View>
                <Text style={[styles.expAmt, { color: colors.foreground }]}>{cur?.symbol ?? ""}{e.amount} {e.currency}</Text>
                <Pressable onPress={() => deleteExpense.mutate(e.id)} hitSlop={8} style={{ paddingLeft: 8 }}>
                  <Icon name="x" size={15} color={colors.mutedForeground} />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowAdd(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add expense</Text>
              <Pressable onPress={() => setShowAdd(false)} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" style={[styles.input, { flex: 2, backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
              <Pressable onPress={() => setCurOpen(true)} style={[styles.input, { flex: 1, backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>{currency.code}</Text>
                <Icon name="chevron-down" size={15} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <View style={styles.catWrap}>
              {CATS.map((c) => (
                <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.catChip, { backgroundColor: category === c.key ? colors.primary : colors.card, borderColor: category === c.key ? colors.primary : colors.border }]}>
                  <Text style={{ fontSize: 13 }}>{c.emoji}</Text>
                  <Text style={[styles.catChipText, { color: category === c.key ? colors.primaryForeground : colors.foreground }]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={merchant} onChangeText={setMerchant} placeholder="Merchant (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Date (blank = today)</Text>
            <DateField value={spentOn} onChange={setSpentOn} mode="date" />
            {trips.length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Trip (optional)</Text>
                <View style={styles.catWrap}>
                  <Pressable onPress={() => setTripId(null)} style={[styles.catChip, { backgroundColor: tripId === null ? colors.primary : colors.card, borderColor: tripId === null ? colors.primary : colors.border }]}>
                    <Text style={[styles.catChipText, { color: tripId === null ? colors.primaryForeground : colors.foreground }]}>None</Text>
                  </Pressable>
                  {trips.map((t) => (
                    <Pressable key={t.id} onPress={() => setTripId(t.id)} style={[styles.catChip, { backgroundColor: tripId === t.id ? colors.primary : colors.card, borderColor: tripId === t.id ? colors.primary : colors.border }]}>
                      <Text style={[styles.catChipText, { color: tripId === t.id ? colors.primaryForeground : colors.foreground }]} numberOfLines={1}>{t.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {formError && <Text style={[styles.err, { color: colors.destructive }]}>{formError}</Text>}
            <Pressable onPress={submit} disabled={addExpense.isPending} style={[styles.solidBtn, { backgroundColor: colors.primary, marginTop: 14, opacity: addExpense.isPending ? 0.8 : 1 }]}>
              {addExpense.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Save expense</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <CurrencyPicker visible={curOpen} onSelect={setCurrency} onClose={() => setCurOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  totalCard: { padding: 20, marginTop: 18 },
  totalLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 0.8 },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 38, color: "#fff", marginTop: 4, letterSpacing: -0.5 },
  totalMeta: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  h2: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 12 },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  catEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  catLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  catAmt: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  catTrack: { height: 6, borderRadius: 3, marginTop: 5, overflow: "hidden" },
  catFill: { height: 6, borderRadius: 3 },
  solidBtn: { flex: 1, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  solidBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  ghostBtn: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ghostBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 14, padding: 28, alignItems: "center", gap: 10, marginTop: 22 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 260 },
  expRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  expEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  expTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  expMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  expAmt: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, fontFamily: "Inter_500Medium", fontSize: 15, justifyContent: "center" },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 10, marginBottom: 6 },
  err: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 10 },
  catWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },
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
