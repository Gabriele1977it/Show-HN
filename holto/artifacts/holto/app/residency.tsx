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

import { Icon } from "@/components/Icon";
import { COUNTRIES, COUNTRY_BY_CODE, type Country } from "@/constants/countries";
import { useColors } from "@/hooks/useColors";

type ResidencyStatus = "safe" | "approaching" | "over";

interface CountryResidency {
  countryCode: string;
  countryName: string;
  daysThisYear: number;
  daysRolling12m: number;
  totalDays: number;
  threshold: number;
  status: ResidencyStatus;
  daysUntilThreshold: number;
}

interface Summary {
  today: string;
  threshold: number;
  countries: CountryResidency[];
}

interface Stay {
  id: number;
  countryCode: string;
  countryName: string;
  arrivalDate: string;
  departureDate: string | null;
  note: string | null;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function statusMeta(status: ResidencyStatus): { label: string; color: string } {
  switch (status) {
    case "over":
      return { label: "Over 183", color: "#E5695F" };
    case "approaching":
      return { label: "Approaching", color: "#C9A24B" };
    default:
      return { label: "Safe", color: "#2ECC71" };
  }
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function CountryPicker({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (c: Country) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)) : COUNTRIES;
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Which country?</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries"
              placeholderTextColor={colors.mutedForeground}
              autoFocus
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>
          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            {filtered.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => {
                  onSelect(c);
                  onClose();
                }}
                style={({ pressed }) => [styles.countryRow, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={styles.flag}>{c.flag}</Text>
                <Text style={[styles.countryName, { color: colors.foreground }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ResidencyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [country, setCountry] = useState<Country | null>(null);
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: summary } = useQuery<Summary>({
    queryKey: ["residency-summary"],
    queryFn: () => customFetch<Summary>("/api/residency/summary", { responseType: "json" }),
    retry: false,
  });
  const { data: staysRaw } = useQuery<Stay[]>({
    queryKey: ["residency-stays"],
    queryFn: () => customFetch<Stay[]>("/api/residency/stays", { responseType: "json" }),
    retry: false,
  });

  const countries = Array.isArray(summary?.countries) ? summary!.countries : [];
  const stays = Array.isArray(staysRaw) ? staysRaw : [];

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["residency-summary"] });
    void qc.invalidateQueries({ queryKey: ["residency-stays"] });
  };

  const addStay = useMutation({
    mutationFn: (body: object) => customFetch("/api/residency/stays", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      setCountry(null);
      setArrival("");
      setDeparture("");
      setFormError(null);
      invalidate();
    },
    onError: () => setFormError("Couldn't save that stay. Check the dates and try again."),
  });

  const deleteStay = useMutation({
    mutationFn: (id: number) => customFetch(`/api/residency/stays/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const markLeft = useMutation({
    mutationFn: (id: number) =>
      customFetch(`/api/residency/stays/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ departureDate: new Date().toISOString().slice(0, 10) }),
      }),
    onSuccess: invalidate,
  });

  const submit = () => {
    if (!country) return setFormError("Pick a country first.");
    if (!ISO.test(arrival)) return setFormError("Enter an arrival date as YYYY-MM-DD.");
    if (departure && !ISO.test(departure)) return setFormError("Departure must be YYYY-MM-DD (or leave blank).");
    if (departure && departure < arrival) return setFormError("Departure can't be before arrival.");
    setFormError(null);
    addStay.mutate({
      countryCode: country.code,
      countryName: country.name,
      arrivalDate: arrival,
      departureDate: departure || null,
    });
  };

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Residency & Tax Days</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Track how long you spend in each country and get a heads-up before you approach the 183-day line.
        </Text>
        <View style={[styles.noteCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Icon name="info" size={15} color={colors.mutedForeground} />
          <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
            Guidance only — not tax advice. Residency rules and tax-year dates vary by country.
          </Text>
        </View>
      </Animated.View>

      {/* Summary */}
      {countries.length > 0 && (
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ marginTop: 22 }}>
          <Text style={[styles.h2, { color: colors.foreground }]}>This year</Text>
          {countries.map((c) => {
            const meta = statusMeta(c.status);
            const pct = Math.min(100, Math.round((Math.max(c.daysThisYear, c.daysRolling12m) / c.threshold) * 100));
            const flag = COUNTRY_BY_CODE[c.countryCode]?.flag ?? "🏳️";
            return (
              <View key={c.countryCode} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={styles.cardTop}>
                  <Text style={[styles.country, { color: colors.foreground }]}>
                    {flag} {c.countryName}
                  </Text>
                  <View style={[styles.chip, { backgroundColor: meta.color + "22" }]}>
                    <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <View style={styles.daysRow}>
                  <Text style={[styles.bigDays, { color: colors.foreground }]}>{c.daysThisYear}</Text>
                  <Text style={[styles.daysUnit, { color: colors.mutedForeground }]}>/ {c.threshold} days this year</Text>
                </View>
                <View style={[styles.track, { backgroundColor: colors.muted }]}>
                  <View style={[styles.fill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                </View>
                <Text style={[styles.metaLine, { color: colors.mutedForeground }]}>
                  {c.daysRolling12m} days in the last 12 months ·{" "}
                  {c.status === "over" ? "threshold passed" : `${c.daysUntilThreshold} days of headroom`}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      )}

      {/* Add a stay */}
      <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginTop: 26 }}>
        <Text style={[styles.h2, { color: colors.foreground }]}>Add a stay</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
        >
          <Text style={{ color: country ? colors.foreground : colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 15 }}>
            {country ? `${country.flag}  ${country.name}` : "Choose a country"}
          </Text>
          <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Arrived</Text>
            <TextInput
              value={arrival}
              onChangeText={setArrival}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Left (optional)</Text>
            <TextInput
              value={departure}
              onChangeText={setDeparture}
              placeholder="Still here"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
        </View>
        {formError && <Text style={[styles.formError, { color: colors.destructive }]}>{formError}</Text>}
        <Pressable
          onPress={submit}
          disabled={addStay.isPending}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, opacity: pressed || addStay.isPending ? 0.85 : 1 }]}
        >
          {addStay.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add stay</Text>
          )}
        </Pressable>
      </Animated.View>

      {/* Stays list */}
      {stays.length > 0 && (
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={{ marginTop: 26 }}>
          <Text style={[styles.h2, { color: colors.foreground }]}>Your stays</Text>
          {stays.map((s) => {
            const flag = COUNTRY_BY_CODE[s.countryCode]?.flag ?? "🏳️";
            return (
              <View key={s.id} style={[styles.stayRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stayCountry, { color: colors.foreground }]}>{flag} {s.countryName}</Text>
                  <Text style={[styles.stayDates, { color: colors.mutedForeground }]}>
                    {fmtDate(s.arrivalDate)} → {s.departureDate ? fmtDate(s.departureDate) : "still here"}
                  </Text>
                </View>
                {!s.departureDate && (
                  <Pressable onPress={() => markLeft.mutate(s.id)} hitSlop={8} style={styles.stayAction}>
                    <Text style={[styles.stayActionText, { color: colors.primary }]}>I've left</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => deleteStay.mutate(s.id)} hitSlop={8} style={styles.stayAction}>
                  <Icon name="trash-2" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            );
          })}
        </Animated.View>
      )}

      {countries.length === 0 && stays.length === 0 && (
        <Animated.View entering={FadeInDown.delay(160).duration(400)} style={[styles.empty, { borderColor: colors.border }]}>
          <Icon name="globe" size={30} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Add your first stay above and HOLTO will start counting your days.
          </Text>
        </Animated.View>
      )}

      <CountryPicker visible={pickerOpen} onSelect={setCountry} onClose={() => setPickerOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  noteCard: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 14, alignItems: "flex-start" },
  noteText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  h2: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 12 },
  card: { borderWidth: 1, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  country: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  daysRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 12 },
  bigDays: { fontFamily: "Inter_700Bold", fontSize: 30, letterSpacing: -0.5 },
  daysUnit: { fontFamily: "Inter_400Regular", fontSize: 13 },
  track: { height: 8, borderRadius: 4, marginTop: 10, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  metaLine: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontFamily: "Inter_500Medium", fontSize: 15, justifyContent: "center" },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 },
  formError: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 10 },
  addBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 14 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  stayRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, padding: 14, marginBottom: 10 },
  stayCountry: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  stayDates: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  stayAction: { paddingHorizontal: 6, paddingVertical: 4 },
  stayActionText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 14, padding: 28, alignItems: "center", gap: 12, marginTop: 22 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 260 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  countryRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  flag: { fontSize: 22 },
  countryName: { fontFamily: "Inter_500Medium", fontSize: 15 },
});
