import { Icon } from "@/components/Icon";
import {
  customFetch,
  getListDisruptionsQueryKey,
  useListDisruptions,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisruptionCard } from "@/components/DisruptionCard";
import { RetryError } from "@/components/RetryError";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  AIRPORTS,
  QUICK_ROUTES,
  calcEU261,
  getAirportDistance,
  type EU261Result,
} from "@/utils/eu261";

const DISRUPTION_TYPES = [
  { key: "delay", label: "Delay" },
  { key: "cancellation", label: "Cancellation" },
  { key: "denied_boarding", label: "Denied Boarding" },
] as const;

const RIGHTS_CARDS = [
  {
    icon: "clock" as const,
    title: "Flight Delayed 3+ Hours",
    summary: "You're owed compensation and care.",
    detail:
      "For delays of 3 hours or more at your final destination, you are entitled to financial compensation under EU/UK261. The airline must also provide meals and refreshments, 2 free phone calls/emails, and hotel accommodation if an overnight stay is necessary.",
    color: "#C9A24B",
  },
  {
    icon: "x-circle" as const,
    title: "Flight Cancelled",
    summary: "Full refund or re-routing — your choice.",
    detail:
      "If your flight is cancelled and you received less than 14 days' notice, you can claim compensation AND choose between a full refund or re-routing at the earliest opportunity. If notified 7–14 days in advance with an acceptable alternative, compensation may be halved.",
    color: "#E74C3C",
  },
  {
    icon: "user-x" as const,
    title: "Denied Boarding",
    summary: "Airlines must ask for volunteers first.",
    detail:
      "If the airline bumps you involuntarily (overbooking), you are entitled to full EU261 compensation, a choice of refund or re-routing, and the same right to care (meals, accommodation) as delayed passengers. The airline must seek volunteers before denying boarding involuntarily.",
    color: "#9B59B6",
  },
  {
    icon: "alert-triangle" as const,
    title: "Extraordinary Circumstances",
    summary: "Not all disruptions qualify for compensation.",
    detail:
      "Airlines are NOT required to pay compensation if the disruption was caused by extraordinary circumstances they could not have avoided — such as severe weather, political instability, security alerts, or air traffic control strikes. However, they must still offer care and a refund or re-routing.",
    color: "#7F8C8D",
  },
];

function RightsCard({ card, colors }: {
  card: typeof RIGHTS_CARDS[number];
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      style={[styles.rightsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
    >
      <View style={styles.rightsCardHeader}>
        <View style={[styles.rightsIconWrap, { backgroundColor: card.color + "18" }]}>
          <Icon name={card.icon} size={18} color={card.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rightsCardTitle, { color: colors.foreground }]}>{card.title}</Text>
          <Text style={[styles.rightsCardSummary, { color: colors.mutedForeground }]}>{card.summary}</Text>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
      </View>
      {expanded && (
        <View style={[styles.rightsCardBody, { borderTopColor: colors.border }]}>
          <Text style={[styles.rightsCardDetail, { color: colors.foreground }]}>{card.detail}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function RightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  const {
    data: disruptions,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useListDisruptions({
    query: { queryKey: getListDisruptionsQueryKey() },
  });

  const handleDelete = useCallback(
    async (id: number) => {
      const remove = async () => {
        try {
          // customFetch applies the API base URL + auth (a raw relative fetch
          // would hit the web host, not the API).
          await customFetch(`/api/disruptions/${id}`, { method: "DELETE" });
          await refetch();
        } catch {
          // silent
        }
      };
      // Alert.alert has no working confirm on web — use the browser dialog there.
      if (Platform.OS === "web") {
        if (typeof window === "undefined" || window.confirm("Delete disruption?\nThis will permanently remove this record.")) {
          await remove();
        }
        return;
      }
      Alert.alert("Delete disruption?", "This will permanently remove this record.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void remove() },
      ]);
    },
    [refetch],
  );

  const [depCode, setDepCode] = useState("");
  const [arrCode, setArrCode] = useState("");
  const [disruptionKind, setDisruptionKind] = useState<"delay" | "cancellation" | "denied_boarding">("delay");
  const [delayHours, setDelayHours] = useState("");
  const [result, setResult] = useState<EU261Result | null>(null);

  const arrRef = useRef<TextInput>(null);

  const depAirport = AIRPORTS[depCode.toUpperCase()];
  const arrAirport = AIRPORTS[arrCode.toUpperCase()];

  const applyQuickRoute = (dep: string, arr: string) => {
    setDepCode(dep);
    setArrCode(arr);
    setResult(null);
  };

  const handleCalculate = () => {
    Keyboard.dismiss();
    const dist = getAirportDistance(depCode, arrCode);
    if (dist === null) {
      Alert.alert("Unknown airport", "Enter valid IATA codes for both airports (e.g. LGW, HRG).");
      return;
    }
    const hours = disruptionKind === "delay" ? parseFloat(delayHours) : undefined;
    const r = calcEU261(dist, disruptionKind, hours);
    setResult(r);
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Your Rights</Text>
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          EU/UK261 calculator and flight rights reference
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={styles.sectionCardHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.primary + "18" }]}>
              <Icon name="sliders" size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.sectionCardTitle, { color: colors.foreground }]}>
                EU261 Compensation Calculator
              </Text>
              <Text style={[styles.sectionCardSub, { color: colors.mutedForeground }]}>
                Find out how much you're owed
              </Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Quick routes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingBottom: 2 }}>
              {QUICK_ROUTES.map((r) => (
                <Pressable
                  key={r.label}
                  onPress={() => applyQuickRoute(r.dep, r.arr)}
                  style={[
                    styles.quickChip,
                    {
                      backgroundColor:
                        depCode === r.dep && arrCode === r.arr
                          ? colors.primary + "20"
                          : colors.background,
                      borderColor:
                        depCode === r.dep && arrCode === r.arr
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.quickChipText, { color: depCode === r.dep && arrCode === r.arr ? colors.primary : colors.foreground }]}>
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={styles.airportRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>From</Text>
              <TextInput
                style={[styles.iataInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. LGW"
                placeholderTextColor={colors.mutedForeground}
                value={depCode}
                onChangeText={(t) => { setDepCode(t.toUpperCase()); setResult(null); }}
                maxLength={4}
                autoCapitalize="characters"
                returnKeyType="next"
                onSubmitEditing={() => arrRef.current?.focus()}
              />
              {depCode.length === 3 && (
                <Text style={[styles.airportName, { color: depAirport ? colors.primary : "#E74C3C" }]}>
                  {depAirport ? depAirport.name : "Unknown airport"}
                </Text>
              )}
            </View>

            <View style={[styles.arrowSep, { backgroundColor: colors.muted }]}>
              <Icon name="arrow-right" size={16} color={colors.mutedForeground} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>To</Text>
              <TextInput
                ref={arrRef}
                style={[styles.iataInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. HRG"
                placeholderTextColor={colors.mutedForeground}
                value={arrCode}
                onChangeText={(t) => { setArrCode(t.toUpperCase()); setResult(null); }}
                maxLength={4}
                autoCapitalize="characters"
                returnKeyType="done"
              />
              {arrCode.length === 3 && (
                <Text style={[styles.airportName, { color: arrAirport ? colors.primary : "#E74C3C" }]}>
                  {arrAirport ? arrAirport.name : "Unknown airport"}
                </Text>
              )}
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 14 }]}>Disruption type</Text>
          <View style={styles.typeRow}>
            {DISRUPTION_TYPES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => { setDisruptionKind(t.key); setResult(null); }}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: disruptionKind === t.key ? colors.primary : colors.background,
                    borderColor: disruptionKind === t.key ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.typeChipText, { color: disruptionKind === t.key ? "#fff" : colors.foreground }]}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {disruptionKind === "delay" && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Delay at destination (hours)</Text>
              <TextInput
                style={[styles.iataInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, width: 120 }]}
                placeholder="e.g. 4"
                placeholderTextColor={colors.mutedForeground}
                value={delayHours}
                onChangeText={(t) => { setDelayHours(t); setResult(null); }}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>
          )}

          <Pressable
            onPress={handleCalculate}
            style={({ pressed }) => [
              styles.calcBtn,
              { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1, marginTop: 18 },
            ]}
          >
            <Icon name="zap" size={16} color="#fff" />
            <Text style={styles.calcBtnText}>Calculate compensation</Text>
          </Pressable>

          {result && (
            <Animated.View entering={FadeInDown.duration(350)} style={[styles.resultCard, { backgroundColor: result.eligible ? colors.primary + "12" : colors.muted, borderColor: result.eligible ? colors.primary + "30" : colors.border }]}>
              {result.eligible ? (
                <>
                  <View style={styles.resultTop}>
                    <View>
                      <Text style={[styles.resultLabel, { color: colors.primary }]}>You may be entitled to</Text>
                      <Text style={[styles.resultAmount, { color: colors.primary }]}>€{result.amount}</Text>
                      <Text style={[styles.resultReduced, { color: colors.mutedForeground }]}>
                        or €{result.reducedAmount} if airline offered re-routing
                      </Text>
                    </View>
                    <View style={[styles.resultBadge, { backgroundColor: colors.primary }]}>
                      <Icon name="check" size={18} color="#fff" />
                    </View>
                  </View>
                  <View style={[styles.resultMeta, { borderTopColor: colors.border }]}>
                    <Text style={[styles.resultMetaText, { color: colors.mutedForeground }]}>
                      {result.tier} · {result.distKm.toLocaleString()} km
                    </Text>
                  </View>
                  {result.note ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={[styles.resultNote, { color: colors.mutedForeground }]}>ⓘ {result.note}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.resultIneligible}>
                  <Icon name="info" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.resultIneligibleText, { color: colors.foreground }]}>
                    {result.reason}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(400)} style={{ marginTop: 24 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Know Your Rights</Text>
        <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Tap a card to expand</Text>
        <View style={{ gap: 10, marginTop: 12 }}>
          {RIGHTS_CARDS.map((card) => (
            <RightsCard key={card.title} card={card} colors={colors} />
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginTop: 28 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Disruption History</Text>
        <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Your reported flight issues</Text>

        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your records…</Text>
          </View>
        )}

        {isError && !isLoading && (
          <RetryError message="Couldn't load your history. Check your connection and try again." onRetry={refetch} />
        )}

        {!isLoading && !isError && disruptions?.length === 0 && (
          <View style={[styles.emptyWrap, { borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted, borderRadius: 24 }]}>
              <Icon name="clock" size={26} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing here yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Report a flight disruption from the home screen and it will appear here.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyBtn,
                { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => router.push("/disruption/wizard")}
            >
              <Text style={styles.emptyBtnText}>Report a problem</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && Array.isArray(disruptions) && disruptions.length > 0 && (
          <View style={{ marginTop: 12, gap: 0 }}>
            <Text style={[styles.countNote, { color: colors.mutedForeground }]}>
              {disruptions.length} disruption{disruptions.length !== 1 ? "s" : ""} on record
            </Text>
            {disruptions.map((d) => (
              <DisruptionCard key={d.id} disruption={d} onDelete={handleDelete} />
            ))}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontFamily: "Inter_700Bold", fontSize: 27, letterSpacing: -0.3, marginBottom: 4 },
  pageSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22 },
  sectionCard: {
    borderWidth: 1,
    padding: 18,
    marginBottom: 4,
  },
  sectionCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  sectionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sectionCardTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  sectionCardSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 },
  quickChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  airportRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  arrowSep: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 22, flexShrink: 0 },
  iataInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: 2,
  },
  airportName: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 5 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  typeChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  calcBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  calcBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  resultCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 16 },
  resultTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  resultLabel: { fontFamily: "Inter_500Medium", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  resultAmount: { fontFamily: "Inter_700Bold", fontSize: 40, letterSpacing: -1 },
  resultReduced: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  resultBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  resultMeta: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  resultMetaText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  resultNote: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  resultIneligible: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  resultIneligibleText: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1, lineHeight: 20 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: -0.2 },
  sectionSub: { fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 3 },
  rightsCard: { borderWidth: 1, padding: 16, marginBottom: 0 },
  rightsCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  rightsIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rightsCardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  rightsCardSummary: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  rightsCardBody: { borderTopWidth: 1, marginTop: 14, paddingTop: 14 },
  rightsCardDetail: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  loadingWrap: { paddingVertical: 40, alignItems: "center", gap: 10 },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  countNote: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 12 },
  emptyWrap: { borderWidth: 1, borderStyle: "dashed", padding: 28, alignItems: "center", gap: 8, marginTop: 16 },
  emptyIcon: { width: 52, height: 52, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 8 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 13, marginTop: 6 },
  emptyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
});
