import { customFetch } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useColors } from "@/hooks/useColors";

interface LeaveResult {
  ok: boolean;
  reason?: string;
  tripType: "domestic" | "international";
  driveSource?: "manual" | "live";
  distanceText?: string;
  durationText?: string;
  recommendedArrivalMinutes: number;
  driveMinutes?: number;
  arriveAirportBy?: string;
  leaveBy?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;

function clock(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}
function dayLabel(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export default function AirportTimingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Pre-fill from a flight when navigated to with params.
  const params = useLocalSearchParams<{ airport?: string; date?: string; time?: string; trip?: string }>();
  const [origin, setOrigin] = useState("");
  const [airport, setAirport] = useState(typeof params.airport === "string" ? params.airport : "");
  const [date, setDate] = useState(typeof params.date === "string" ? params.date : "");
  const [time, setTime] = useState(typeof params.time === "string" ? params.time : "");
  const [intl, setIntl] = useState(params.trip !== "domestic");
  const [manualDrive, setManualDrive] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeaveResult | null>(null);

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const calc = useMutation({
    mutationFn: (body: object) => customFetch<LeaveResult>("/api/airport/leave-time", { method: "POST", body: JSON.stringify(body), responseType: "json" }),
    onSuccess: (r) => setResult(r),
    onError: () => setError("Couldn't work that out. Check your details and try again."),
  });

  function run(withManual?: boolean) {
    if (!ISO_DATE.test(date)) return setError("Enter the flight date as YYYY-MM-DD.");
    if (!HHMM.test(time)) return setError("Enter the departure time as HH:MM.");
    if (!withManual && !origin.trim()) return setError("Enter where you're leaving from.");
    if (!withManual && !airport.trim()) return setError("Enter the airport (e.g. LHR).");
    const drive = withManual ? parseInt(manualDrive, 10) : undefined;
    if (withManual && (!Number.isFinite(drive) || (drive as number) < 0)) return setError("Enter the drive time in minutes.");
    setError(null);
    calc.mutate({
      departureAt: `${date}T${time}:00Z`,
      tripType: intl ? "international" : "domestic",
      origin: origin.trim() || undefined,
      airport: airport.trim() || undefined,
      driveMinutes: withManual ? drive : undefined,
    });
  }

  const needsManual = result != null && result.ok === false;
  const manualMessage =
    result?.reason === "no_provider"
      ? "Live traffic isn't switched on yet. Enter your estimated drive time and we'll do the rest."
      : "We couldn't fetch live traffic for that route. Enter your estimated drive time and we'll do the rest.";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>When to leave</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          HOLTO checks live traffic to your airport and tells you exactly when to head out.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ marginTop: 18, gap: 8 }}>
        <TextInput value={origin} onChangeText={setOrigin} placeholder="Leaving from (address, hotel or postcode)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
        <TextInput value={airport} onChangeText={setAirport} placeholder="Airport (e.g. LHR or Lisbon Airport)" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <DateField value={date} onChange={setDate} mode="date" flex={2} />
          <DateField value={time} onChange={setTime} mode="time" flex={1} />
        </View>
        <View style={styles.toggleRow}>
          {(["domestic", "international"] as const).map((t) => {
            const active = intl === (t === "international");
            return (
              <Pressable key={t} onPress={() => setIntl(t === "international")} style={[styles.toggle, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
                <Text style={[styles.toggleText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                  {t === "international" ? "International (3h)" : "Domestic (2h)"}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {error && <Text style={[styles.err, { color: colors.destructive }]}>{error}</Text>}
        <Pressable onPress={() => run(false)} disabled={calc.isPending} style={[styles.cta, { backgroundColor: colors.primary, opacity: calc.isPending ? 0.8 : 1 }]}>
          {calc.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Calculate</Text>}
        </Pressable>
      </Animated.View>

      {/* Manual drive fallback when Maps can't route */}
      {needsManual && (
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginTop: 18 }]}>
          <Text style={[styles.cardNote, { color: colors.mutedForeground }]}>{manualMessage}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
            <TextInput value={manualDrive} onChangeText={setManualDrive} placeholder="45" keyboardType="number-pad" placeholderTextColor={colors.mutedForeground} style={[styles.input, { flex: 1, backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>minutes</Text>
            <Pressable onPress={() => run(true)} style={[styles.cta, { backgroundColor: colors.primary, flex: 1, marginTop: 0 }]}>
              <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Go</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Result */}
      {result && result.ok && (
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 20 }}>
          <View style={[styles.leaveCard, { backgroundColor: colors.primary, borderRadius: colors.radius }]}>
            <Text style={styles.leaveLabel}>LEAVE BY</Text>
            <Text style={styles.leaveTime}>{clock(result.leaveBy)}</Text>
            <Text style={styles.leaveDay}>{dayLabel(result.leaveBy)}</Text>
          </View>
          <View style={[styles.detailCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Row label="Drive time" value={`${result.driveMinutes} min${result.driveSource === "live" ? " (live traffic)" : ""}`} colors={colors} icon="navigation" />
            {result.distanceText ? <Row label="Distance" value={result.distanceText} colors={colors} icon="map-pin" /> : null}
            <Row label="Be at the airport by" value={`${clock(result.arriveAirportBy)}`} colors={colors} icon="clock" />
            <Row label="Airport buffer" value={`${result.recommendedArrivalMinutes} min before departure`} colors={colors} icon="shield" last />
          </View>
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Times shown as entered. Add a little extra for long security lines or unfamiliar airports.
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

function Row({ label, value, colors, icon, last }: { label: string; value: string; colors: ReturnType<typeof useColors>; icon: React.ComponentProps<typeof Icon>["name"]; last?: boolean }) {
  return (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={icon} size={15} color={colors.mutedForeground} />
        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, fontFamily: "Inter_500Medium", fontSize: 15, justifyContent: "center" },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggle: { flex: 1, borderWidth: 1, borderRadius: 10, height: 46, alignItems: "center", justifyContent: "center" },
  toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  err: { fontFamily: "Inter_500Medium", fontSize: 13 },
  cta: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 6 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  card: { borderWidth: 1, padding: 16 },
  cardNote: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  leaveCard: { padding: 24, alignItems: "center" },
  leaveLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "rgba(255,255,255,0.8)", letterSpacing: 1.2 },
  leaveTime: { fontFamily: "Inter_700Bold", fontSize: 52, color: "#fff", letterSpacing: -1, marginTop: 4 },
  leaveDay: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  detailCard: { borderWidth: 1, marginTop: 12, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  rowLabel: { fontFamily: "Inter_400Regular", fontSize: 14 },
  rowValue: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  disclaimer: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 10, lineHeight: 17 },
});
