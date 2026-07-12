import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { Icon } from "@/components/Icon";
import { ShareRecapSheet } from "@/components/ShareRecapSheet";
import { useColors } from "@/hooks/useColors";

type ItemType = "flight" | "hotel" | "train" | "car" | "activity" | "other";

const TYPE_META: Record<ItemType, { emoji: string; label: string }> = {
  flight: { emoji: "✈️", label: "Flight" },
  hotel: { emoji: "🏨", label: "Hotel" },
  train: { emoji: "🚆", label: "Train" },
  car: { emoji: "🚗", label: "Car" },
  activity: { emoji: "🎟️", label: "Activity" },
  other: { emoji: "📍", label: "Other" },
};

interface TripItem {
  id: number;
  type: ItemType;
  title: string;
  startAt: string | null;
  endAt: string | null;
  location: string | null;
  reference: string | null;
}
interface Trip {
  id: number;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  items: TripItem[];
  expenseTotalGBP?: number;
  isPublic?: boolean;
  publicSlug?: string | null;
  publicShowSpend?: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "Dates to be added";
  const f = (s: string) =>
    new Date(`${s}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return end && end !== start ? `${f(start)} – ${f(end)}` : f(start);
}

function fmtItemTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
  return hasTime
    ? `${date} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`
    : date;
}

export default function TripsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [showNewTrip, setShowNewTrip] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDest, setTDest] = useState("");
  const [tStart, setTStart] = useState("");
  const [tEnd, setTEnd] = useState("");
  const [tripError, setTripError] = useState<string | null>(null);

  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [shareTrip, setShareTrip] = useState<Trip | null>(null);

  const [itemFor, setItemFor] = useState<number | null>(null);
  const [iType, setIType] = useState<ItemType>("flight");
  const [iTitle, setITitle] = useState("");
  const [iDate, setIDate] = useState("");
  const [iTime, setITime] = useState("");
  const [iLoc, setILoc] = useState("");
  const [iRef, setIRef] = useState("");
  const [itemError, setItemError] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const { data: tripsRaw, isLoading } = useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: () => customFetch<Trip[]>("/api/trips", { responseType: "json" }),
    retry: false,
  });
  const trips = Array.isArray(tripsRaw) ? tripsRaw : [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["trips"] });

  const addTrip = useMutation({
    mutationFn: (body: object) => customFetch("/api/trips", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      setShowNewTrip(false);
      setTTitle("");
      setTDest("");
      setTStart("");
      setTEnd("");
      setTripError(null);
      void invalidate();
    },
    onError: () => setTripError("Couldn't create that trip. Check the dates and try again."),
  });

  const deleteTrip = useMutation({
    mutationFn: (id: number) => customFetch(`/api/trips/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  const parseTrip = useMutation({
    mutationFn: (text: string) => customFetch("/api/trips/parse", { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: () => {
      setShowPaste(false);
      setPasteText("");
      setPasteError(null);
      void invalidate();
    },
    onError: (err: unknown) => {
      const msg = (err as { data?: { error?: string } }).data?.error;
      setPasteError(msg ?? "Couldn't read that booking. Try adding it manually.");
    },
  });

  const addItem = useMutation({
    mutationFn: ({ tripId, body }: { tripId: number; body: object }) =>
      customFetch(`/api/trips/${tripId}/items`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      closeItemForm();
      void invalidate();
    },
    onError: () => setItemError("Couldn't add that item. Check the date and try again."),
  });

  const deleteItem = useMutation({
    mutationFn: ({ tripId, itemId }: { tripId: number; itemId: number }) =>
      customFetch(`/api/trips/${tripId}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  function closeItemForm() {
    setItemFor(null);
    setIType("flight");
    setITitle("");
    setIDate("");
    setITime("");
    setILoc("");
    setIRef("");
    setItemError(null);
  }

  function submitTrip() {
    if (!tTitle.trim()) return setTripError("Give your trip a name.");
    if (tStart && !ISO_DATE.test(tStart)) return setTripError("Start must be YYYY-MM-DD.");
    if (tEnd && !ISO_DATE.test(tEnd)) return setTripError("End must be YYYY-MM-DD.");
    setTripError(null);
    addTrip.mutate({ title: tTitle, destination: tDest || undefined, startDate: tStart || undefined, endDate: tEnd || undefined });
  }

  function submitItem() {
    if (itemFor == null) return;
    if (!iTitle.trim()) return setItemError("Give the item a name.");
    if (iDate && !ISO_DATE.test(iDate)) return setItemError("Date must be YYYY-MM-DD.");
    if (iTime && !/^\d{2}:\d{2}$/.test(iTime)) return setItemError("Time must be HH:MM.");
    const startAt = iDate ? `${iDate}T${iTime || "00:00"}:00Z` : undefined;
    setItemError(null);
    addItem.mutate({
      tripId: itemFor,
      body: { type: iType, title: iTitle, startAt, location: iLoc || undefined, reference: iRef || undefined },
    });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Your Trips</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          One timeline for every journey — flights, hotels and plans in one place.
        </Text>
      </Animated.View>

      {/* New trip */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ marginTop: 16 }}>
        {!showNewTrip ? (
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => { setPasteError(null); setShowPaste(true); }}
              style={({ pressed }) => [styles.pasteBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
            >
              <Text style={{ fontSize: 15 }}>✨</Text>
              <Text style={[styles.pasteBtnText, { color: colors.primaryForeground }]}>Paste a booking confirmation</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowNewTrip(true)}
              style={({ pressed }) => [styles.newBtn, { borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.newBtnText, { color: colors.mutedForeground }]}>or add a trip manually</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <TextInput value={tTitle} onChangeText={setTTitle} placeholder="Trip name (e.g. Lisbon sprint)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
            <TextInput value={tDest} onChangeText={setTDest} placeholder="Destination (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Start</Text>
                <DateField value={tStart} onChange={setTStart} mode="date" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>End</Text>
                <DateField value={tEnd} onChange={setTEnd} mode="date" />
              </View>
            </View>
            {tripError && <Text style={[styles.err, { color: colors.destructive }]}>{tripError}</Text>}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => { setShowNewTrip(false); setTripError(null); }} style={[styles.ghostBtn, { borderColor: colors.border }]}>
                <Text style={[styles.ghostBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitTrip} disabled={addTrip.isPending} style={[styles.solidBtn, { backgroundColor: colors.primary, opacity: addTrip.isPending ? 0.8 : 1 }]}>
                {addTrip.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Create trip</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </Animated.View>

      {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />}

      {!isLoading && trips.length === 0 && !showNewTrip && (
        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={[styles.empty, { borderColor: colors.border }]}>
          <Text style={{ fontSize: 30 }}>🧳</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No trips yet. Create one above, then add your flights and hotels to build the timeline.
          </Text>
        </Animated.View>
      )}

      {trips.map((trip, idx) => (
        <Animated.View key={trip.id} entering={FadeInDown.delay(120 + idx * 40).duration(400)} style={[styles.tripCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={styles.tripHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tripTitle, { color: colors.foreground }]}>{trip.title}</Text>
              <Text style={[styles.tripMeta, { color: colors.mutedForeground }]}>
                {fmtRange(trip.startDate, trip.endDate)}{trip.destination ? ` · ${trip.destination}` : ""}
              </Text>
            </View>
            {(trip.expenseTotalGBP ?? 0) > 0 && (
              <Pressable onPress={() => router.push("/expenses")} style={[styles.spendPill, { backgroundColor: colors.muted }]} hitSlop={6}>
                <Text style={[styles.spendText, { color: colors.foreground }]}>£{Math.round(trip.expenseTotalGBP!).toLocaleString("en-GB")}</Text>
              </Pressable>
            )}
            <Pressable onPress={() => deleteTrip.mutate(trip.id)} hitSlop={8} style={{ padding: 4, marginLeft: 8 }}>
              <Icon name="trash-2" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {trip.items.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {trip.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <Text style={styles.itemEmoji}>{TYPE_META[it.type]?.emoji ?? "📍"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: colors.foreground }]}>{it.title}</Text>
                    <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                      {[fmtItemTime(it.startAt), it.location, it.reference && `Ref ${it.reference}`].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  <Pressable onPress={() => deleteItem.mutate({ tripId: trip.id, itemId: it.id })} hitSlop={8} style={{ padding: 4 }}>
                    <Icon name="x" size={15} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            <Pressable onPress={() => { closeItemForm(); setItemFor(trip.id); }} style={[styles.addItemBtn, { borderColor: colors.border, flex: 1, marginTop: 0 }]}>
              <Text style={[styles.addItemText, { color: colors.primary }]}>＋ Add flight, hotel or plan</Text>
            </Pressable>
            <Pressable onPress={() => setShareTrip(trip)} style={[styles.shareRecapBtn, { borderColor: colors.border }]} accessibilityLabel="Share trip recap">
              <Icon name="share-2" size={15} color={trip.isPublic ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.shareRecapText, { color: trip.isPublic ? colors.primary : colors.mutedForeground }]}>
                {trip.isPublic ? "Public" : "Share"}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ))}

      {/* Paste-a-booking modal */}
      <Modal visible={showPaste} animationType="slide" transparent onRequestClose={() => setShowPaste(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowPaste(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Paste a booking</Text>
              <Pressable onPress={() => setShowPaste(false)} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <Text style={[styles.pasteHint, { color: colors.mutedForeground }]}>
              Paste the text of a flight, hotel or train confirmation and HOLTO will build the trip for you.
            </Text>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              placeholder="Paste your confirmation email here…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              textAlignVertical="top"
              style={[styles.pasteArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
            {pasteError && <Text style={[styles.err, { color: colors.destructive }]}>{pasteError}</Text>}
            <Pressable
              onPress={() => { if (pasteText.trim().length >= 15) { setPasteError(null); parseTrip.mutate(pasteText); } else setPasteError("Paste a bit more of the confirmation."); }}
              disabled={parseTrip.isPending}
              style={[styles.solidBtn, { backgroundColor: colors.primary, marginTop: 14, opacity: parseTrip.isPending ? 0.8 : 1 }]}
            >
              {parseTrip.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Build my trip</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add-item modal */}
      <Modal visible={itemFor != null} animationType="slide" transparent onRequestClose={closeItemForm}>
        <Pressable style={styles.backdrop} onPress={closeItemForm}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Add to trip</Text>
              <Pressable onPress={closeItemForm} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
            </View>
            <View style={styles.typeRow}>
              {(Object.keys(TYPE_META) as ItemType[]).map((t) => (
                <Pressable key={t} onPress={() => setIType(t)} style={[styles.typeChip, { backgroundColor: iType === t ? colors.primary : colors.card, borderColor: iType === t ? colors.primary : colors.border }]}>
                  <Text style={{ fontSize: 14 }}>{TYPE_META[t].emoji}</Text>
                  <Text style={[styles.typeChipText, { color: iType === t ? colors.primaryForeground : colors.foreground }]}>{TYPE_META[t].label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput value={iTitle} onChangeText={setITitle} placeholder={iType === "flight" ? "e.g. BA503 LHR → LIS" : "Title"} placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <DateField value={iDate} onChange={setIDate} mode="date" flex={2} />
              <DateField value={iTime} onChange={setITime} mode="time" flex={1} />
            </View>
            <TextInput value={iLoc} onChangeText={setILoc} placeholder="Location (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
            <TextInput value={iRef} onChangeText={setIRef} placeholder="Booking reference (optional)" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
            {itemError && <Text style={[styles.err, { color: colors.destructive }]}>{itemError}</Text>}
            <Pressable onPress={submitItem} disabled={addItem.isPending} style={[styles.solidBtn, { backgroundColor: colors.primary, marginTop: 14, opacity: addItem.isPending ? 0.8 : 1 }]}>
              {addItem.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Add to timeline</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Pressable onPress={() => router.push("/expenses")} style={{ marginTop: 22 }}>
        <Text style={[styles.footLink, { color: colors.mutedForeground }]}>Logging spend on this trip? Open Expenses →</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/residency")} style={{ marginTop: 12 }}>
        <Text style={[styles.footLink, { color: colors.mutedForeground }]}>Tracking days per country? Open Residency & Tax Days →</Text>
      </Pressable>

      <ShareRecapSheet trip={shareTrip} onClose={() => setShareTrip(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  pasteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, height: 52 },
  pasteBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  pasteHint: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  pasteArea: { borderWidth: 1, borderRadius: 12, padding: 14, minHeight: 160, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  shareRecapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 10, height: 40, paddingHorizontal: 14 },
  shareRecapText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, height: 44 },
  newBtnText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  formCard: { borderWidth: 1, padding: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46, fontFamily: "Inter_500Medium", fontSize: 15, justifyContent: "center" },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 },
  err: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 10 },
  ghostBtn: { flex: 1, height: 46, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  solidBtn: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  solidBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 14, padding: 28, alignItems: "center", gap: 12, marginTop: 22 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280 },
  tripCard: { borderWidth: 1, padding: 16, marginTop: 14 },
  tripHeader: { flexDirection: "row", alignItems: "flex-start" },
  tripTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  tripMeta: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  spendPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  spendText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  itemEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  itemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  itemMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  addItemBtn: { borderTopWidth: 1, marginTop: 10, paddingTop: 12, alignItems: "center" },
  addItemText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  typeChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  footLink: { fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
