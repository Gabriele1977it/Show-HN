import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/components/DateField";
import { AwardWalletCard } from "@/components/AwardWalletCard";
import { Icon, type IconName } from "@/components/Icon";
import { SkeletonCard } from "@/components/Skeleton";
import { useColors } from "@/hooks/useColors";

type Category = "airline" | "hotel" | "rail" | "car" | "card" | "other";

interface Program {
  id: number;
  category: Category;
  programName: string;
  membershipNumber: string | null;
  tier: string | null;
  pointsBalance: number | null;
  expiresAt: string | null;
  notes: string | null;
}

const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  airline: { label: "Airline", emoji: "✈️" },
  hotel: { label: "Hotel", emoji: "🏨" },
  rail: { label: "Rail", emoji: "🚆" },
  car: { label: "Car hire", emoji: "🚗" },
  card: { label: "Card", emoji: "💳" },
  other: { label: "Other", emoji: "🎟️" },
};
const CATEGORY_ORDER: Category[] = ["airline", "hotel", "rail", "car", "card", "other"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const b = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(b)) return null;
  const a = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
function expiryLabel(iso: string | null): { text: string; soon: boolean } | null {
  const d = daysUntil(iso);
  if (d == null) return null;
  if (d < 0) return { text: "Expired", soon: true };
  if (d === 0) return { text: "Expires today", soon: true };
  if (d <= 45) return { text: `Expires in ${d}d`, soon: true };
  const nice = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return { text: `Expires ${nice}`, soon: false };
}

interface FormState {
  id?: number;
  category: Category;
  programName: string;
  membershipNumber: string;
  tier: string;
  pointsBalance: string;
  expiresAt: string;
  notes: string;
}
const EMPTY_FORM: FormState = { category: "airline", programName: "", membershipNumber: "", tier: "", pointsBalance: "", expiresAt: "", notes: "" };

export default function LoyaltyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const { data, isLoading } = useQuery<Program[]>({
    queryKey: ["loyalty"],
    queryFn: () => customFetch<Program[]>("/api/loyalty", { responseType: "json" }),
    retry: false,
  });
  const programs = Array.isArray(data) ? data : [];

  const grouped = useMemo(() => {
    const m = new Map<Category, Program[]>();
    for (const p of programs) {
      const list = m.get(p.category) ?? [];
      list.push(p);
      m.set(p.category, list);
    }
    return CATEGORY_ORDER.filter((c) => m.has(c)).map((c) => ({ category: c, items: m.get(c)! }));
  }, [programs]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["loyalty"] });

  const save = useMutation({
    mutationFn: (body: FormState) => {
      const payload = {
        category: body.category,
        programName: body.programName.trim(),
        membershipNumber: body.membershipNumber.trim() || null,
        tier: body.tier.trim() || null,
        pointsBalance: body.pointsBalance.trim() === "" ? null : Number(body.pointsBalance),
        expiresAt: body.expiresAt.trim() || null,
        notes: body.notes.trim() || null,
      };
      return body.id
        ? customFetch(`/api/loyalty/${body.id}`, { method: "PATCH", body: JSON.stringify(payload), responseType: "json" })
        : customFetch("/api/loyalty", { method: "POST", body: JSON.stringify(payload), responseType: "json" });
    },
    onSuccess: () => {
      setModal(false);
      invalidate();
    },
    onError: () => setError("Couldn't save that. Check the details and try again."),
  });

  const remove = useMutation({
    mutationFn: (id: number) => customFetch(`/api/loyalty/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setModal(false);
      invalidate();
    },
  });

  function openAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setModal(true);
  }
  function openEdit(p: Program) {
    setForm({
      id: p.id,
      category: p.category,
      programName: p.programName,
      membershipNumber: p.membershipNumber ?? "",
      tier: p.tier ?? "",
      pointsBalance: p.pointsBalance != null ? String(p.pointsBalance) : "",
      expiresAt: p.expiresAt ?? "",
      notes: p.notes ?? "",
    });
    setError(null);
    setModal(true);
  }
  function submit() {
    if (!form.programName.trim()) return setError("Give the programme a name.");
    if (form.expiresAt && !ISO_DATE.test(form.expiresAt)) return setError("Expiry must be a valid date.");
    setError(null);
    save.mutate(form);
  }
  function confirmDelete() {
    if (!form.id) return;
    if (Platform.OS === "web") {
      const ok = typeof window === "undefined" || window.confirm("Remove this programme from your wallet?");
      if (ok) remove.mutate(form.id);
      return;
    }
    remove.mutate(form.id);
  }

  async function copyNumber(p: Program) {
    if (!p.membershipNumber) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(p.membershipNumber);
        setCopied(p.id);
        setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1500);
      } catch {
        /* clipboard blocked — no-op */
      }
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad + 8, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[styles.h1, { color: colors.foreground }]}>Loyalty & points</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Every membership in one wallet — numbers ready at check-in, and a nudge before points expire.
          </Text>
        </Animated.View>

        <Pressable onPress={openAdd} style={[styles.addBtn, colors.shadow, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
          <Icon name="award" size={17} color={colors.primaryForeground} />
          <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add a programme</Text>
        </Pressable>

        <AwardWalletCard onSynced={invalidate} />

        {isLoading ? (
          <View style={{ marginTop: 24 }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : programs.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={{ fontSize: 32 }}>🏆</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your wallet is empty</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Add your frequent-flyer, hotel and card programmes so their numbers are one tap away — and you never lose points to an expiry you forgot.
            </Text>
          </View>
        ) : (
          grouped.map((group, gi) => (
            <Animated.View key={group.category} entering={FadeInDown.delay(60 + gi * 40).duration(400)} style={{ marginTop: 22 }}>
              <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>
                {CATEGORY_META[group.category].emoji}  {CATEGORY_META[group.category].label.toUpperCase()}
              </Text>
              {group.items.map((p) => {
                const exp = expiryLabel(p.expiresAt);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => openEdit(p)}
                    style={({ pressed }) => [
                      styles.card,
                      colors.shadow,
                      { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.99 : 1 }] },
                    ]}
                  >
                    <View style={styles.cardTop}>
                      <Text style={[styles.programName, { color: colors.foreground }]} numberOfLines={1}>{p.programName}</Text>
                      {p.tier ? (
                        <View style={[styles.tierBadge, { backgroundColor: colors.gold + "22" }]}>
                          <Text style={[styles.tierText, { color: colors.accent }]}>{p.tier}</Text>
                        </View>
                      ) : null}
                    </View>

                    {p.membershipNumber ? (
                      <Pressable onPress={() => copyNumber(p)} style={styles.numberRow} hitSlop={6}>
                        <Text style={[styles.number, { color: colors.mutedForeground }]}>{p.membershipNumber}</Text>
                        {Platform.OS === "web" ? (
                          <Text style={[styles.copyHint, { color: colors.primary }]}>{copied === p.id ? "Copied ✓" : "Copy"}</Text>
                        ) : null}
                      </Pressable>
                    ) : null}

                    <View style={styles.cardBottom}>
                      {p.pointsBalance != null ? (
                        <Text style={[styles.points, { color: colors.foreground }]}>
                          {p.pointsBalance.toLocaleString("en-GB")} <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>pts</Text>
                        </Text>
                      ) : <View />}
                      {exp ? (
                        <View style={[styles.expPill, { backgroundColor: exp.soon ? colors.destructive + "1A" : colors.muted }]}>
                          <Text style={[styles.expText, { color: exp.soon ? colors.destructive : colors.mutedForeground }]}>{exp.text}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{form.id ? "Edit programme" : "Add a programme"}</Text>
              <Pressable onPress={() => setModal(false)} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
              <View style={styles.chipRow}>
                {CATEGORY_ORDER.map((c) => {
                  const active = form.category === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setForm((f) => ({ ...f, category: c }))}
                      style={[styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                        {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Field label="Programme name" value={form.programName} onChange={(v) => setForm((f) => ({ ...f, programName: v }))} placeholder="British Airways Executive Club" colors={colors} />
              <Field label="Membership number" value={form.membershipNumber} onChange={(v) => setForm((f) => ({ ...f, membershipNumber: v }))} placeholder="e.g. 12345678" colors={colors} autoCapitalize="characters" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Tier (optional)" value={form.tier} onChange={(v) => setForm((f) => ({ ...f, tier: v }))} placeholder="Gold" colors={colors} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Points (optional)" value={form.pointsBalance} onChange={(v) => setForm((f) => ({ ...f, pointsBalance: v.replace(/[^0-9]/g, "") }))} placeholder="42000" colors={colors} keyboardType="number-pad" />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Points/status expiry (optional)</Text>
              <DateField value={form.expiresAt} onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))} mode="date" />

              <Field label="Notes (optional)" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} placeholder="Lounge access, companion voucher…" colors={colors} />

              {error ? <Text style={[styles.err, { color: colors.destructive }]}>{error}</Text> : null}

              <Pressable onPress={submit} disabled={save.isPending} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: save.isPending ? 0.7 : 1 }]}>
                {save.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>{form.id ? "Save changes" : "Add to wallet"}</Text>}
              </Pressable>
              {form.id ? (
                <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
                  <Text style={[styles.deleteText, { color: colors.destructive }]}>Remove from wallet</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, colors, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  keyboardType?: "default" | "number-pad";
  autoCapitalize?: "none" | "characters";
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, marginTop: 6 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, marginTop: 18 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  empty: { alignItems: "center", borderWidth: 1, padding: 28, marginTop: 20, gap: 10 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  groupLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  card: { borderWidth: 1, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  programName: { fontFamily: "Inter_600SemiBold", fontSize: 16, flex: 1 },
  tierBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tierText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  numberRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  number: { fontFamily: "Inter_500Medium", fontSize: 14, letterSpacing: 1 },
  copyHint: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  points: { fontFamily: "Inter_700Bold", fontSize: 16 },
  expPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  expText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 6, marginTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, fontFamily: "Inter_500Medium", fontSize: 15 },
  err: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 12 },
  saveBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 18 },
  saveBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  deleteBtn: { alignItems: "center", paddingVertical: 14, marginTop: 4 },
  deleteText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
