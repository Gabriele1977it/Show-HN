import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

type FlightStatus = "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted" | "unknown";

interface JourneyFlight {
  tripItemId: number;
  tripId: number;
  tripTitle: string;
  title: string;
  flightNumber: string | null;
  reference: string | null;
  depAirport: string | null;
  arrAirport: string | null;
  scheduledDep: string | null;
  scheduledArr: string | null;
  estimatedDep: string | null;
  status: FlightStatus;
  depGate: string | null;
  depTerminal: string | null;
  depDelay: number | null;
  live: boolean;
}

interface JourneyResponse {
  hasFlight: boolean;
  flight?: JourneyFlight;
}

function statusLabel(s: FlightStatus) {
  return { scheduled: "Scheduled", active: "In air", landed: "Landed", cancelled: "Cancelled", incident: "Incident", diverted: "Diverted", unknown: "Watching" }[s] ?? "Watching";
}
function statusColor(s: FlightStatus): string {
  switch (s) {
    case "active": return "#1C7C8C";
    case "landed": return "#2E7D52";
    case "cancelled": return "#C0392B";
    case "incident":
    case "diverted": return "#C9A24B";
    default: return "#6B8A94";
  }
}

function clock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}
function dayLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
function isoDatePart(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
function isoTimePart(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 16);
}

// A calm, deterministic one-liner — no LLM, so it works offline and free.
function headline(f: JourneyFlight): string {
  if (f.status === "cancelled") return "This flight is showing as cancelled. Check your rights and rebooking options.";
  if (f.status === "diverted" || f.status === "incident") return "There's a disruption on this flight — tap through for the rescue flow.";
  if (f.depDelay && f.depDelay >= 15) return `Running about ${f.depDelay} min late. We'll keep watching and nudge you if it changes.`;
  if (f.status === "landed") return "You've landed. Safe travels onward.";
  if (f.status === "active") return "You're in the air. We'll have arrival details when you land.";
  return "Everything's on track. Here's your plan for the day.";
}

interface Step {
  icon: IconName;
  title: string;
  sub: string;
  time?: string;
  onPress?: () => void;
  cta?: string;
  tone?: "normal" | "warn" | "alert";
}

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["journey-next"],
    queryFn: () => customFetch<JourneyResponse>("/api/journey/next"),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const flight = data?.flight;

  if (isError || !data?.hasFlight || !flight) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingTop: topPad + 8 }}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Your travel day</Text>
        <View style={[styles.emptyCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 34 }}>🧳</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No flight coming up</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Add a flight to a trip and HOLTO will build your travel-day timeline — when to leave, your gate, and live status — right here.
          </Text>
          <Pressable onPress={() => router.push("/trips")} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Go to Trips</Text>
          </Pressable>
          {isError ? (
            <Pressable onPress={() => refetch()} style={{ marginTop: 12 }}>
              <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 13 }}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  const depTime = clock(flight.estimatedDep ?? flight.scheduledDep);
  const arrTime = clock(flight.scheduledArr);
  const delayed = !!flight.depDelay && flight.depDelay >= 15;
  const disrupted = flight.status === "cancelled" || flight.status === "diverted" || flight.status === "incident";

  const steps: Step[] = [
    {
      icon: "navigation" as IconName,
      title: "Leave for the airport",
      sub: "Check live traffic and get your exact leave-by time.",
      cta: "Plan it",
      onPress: () =>
        router.push(
          `/airport-timing?airport=${encodeURIComponent(flight.depAirport ?? "")}&date=${isoDatePart(flight.scheduledDep)}&time=${isoTimePart(flight.scheduledDep)}` as never,
        ),
    },
    {
      icon: "check-square" as IconName,
      title: "Check in & bag drop",
      sub: flight.reference ? `Booking ref ${flight.reference}. Have your passport ready.` : "Have your passport and boarding pass ready.",
    },
    {
      icon: "users" as IconName,
      title: "Boarding",
      sub: flight.depGate || flight.depTerminal
        ? [flight.depTerminal ? `Terminal ${flight.depTerminal}` : null, flight.depGate ? `Gate ${flight.depGate}` : null].filter(Boolean).join(" · ")
        : "Gate is usually announced 30–45 min before departure.",
    },
    {
      icon: "send" as IconName,
      title: "Departure",
      sub: `${flight.depAirport ?? "Departure"}${delayed ? ` · delayed ~${flight.depDelay} min` : ""}`,
      time: depTime,
      tone: delayed ? "warn" : "normal",
    },
    {
      icon: "map-pin" as IconName,
      title: "Arrival",
      sub: flight.arrAirport ?? "Destination",
      time: arrTime,
    },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{dayLabel(flight.scheduledDep).toUpperCase()}</Text>
        <Text style={[styles.h1, { color: colors.foreground }]}>Your travel day</Text>
      </Animated.View>

      {/* Hero flight summary */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <LinearGradient colors={["#0A2E38", "#0E3F50"]} style={[styles.hero, { borderRadius: colors.radius }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroFlight}>{flight.flightNumber ?? flight.title}</Text>
              <Text style={styles.heroRoute}>
                {(flight.depAirport ?? "—")} → {(flight.arrAirport ?? "—")}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(flight.status) + "33" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor(flight.status) }]} />
              <Text style={[styles.statusText, { color: "#fff" }]}>{statusLabel(flight.status)}</Text>
            </View>
          </View>
          <View style={styles.heroTimes}>
            <View>
              <Text style={styles.heroTimeLabel}>DEPART</Text>
              <Text style={styles.heroTime}>{depTime}</Text>
            </View>
            <Icon name="arrow-right" size={16} color="rgba(255,255,255,0.4)" />
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.heroTimeLabel}>ARRIVE</Text>
              <Text style={styles.heroTime}>{arrTime}</Text>
            </View>
          </View>
          <Text style={styles.heroHeadline}>{headline(flight)}</Text>
          {!flight.live ? (
            <Text style={styles.heroFallback}>Showing your itinerary times — live status will appear closer to departure.</Text>
          ) : null}
        </LinearGradient>
      </Animated.View>

      {disrupted ? (
        <Animated.View entering={FadeInDown.delay(90).duration(400)}>
          <Pressable
            onPress={() => router.push("/disruption/wizard")}
            style={[styles.rescueBtn, colors.shadow, { backgroundColor: colors.destructive, borderRadius: colors.radius }]}
          >
            <Icon name="alert-circle" size={18} color="#fff" />
            <Text style={styles.rescueText}>Start the disruption rescue</Text>
            <Icon name="chevron-right" size={18} color="#fff" />
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Timeline */}
      <View style={{ marginTop: 22 }}>
        {steps.map((s, i) => (
          <Animated.View key={s.title} entering={FadeInDown.delay(120 + i * 50).duration(400)} style={styles.stepRow}>
            <View style={styles.rail}>
              <View style={[styles.node, { backgroundColor: s.tone === "warn" ? colors.gold : colors.primary, borderColor: colors.background }]}>
                <Icon name={s.icon} size={13} color="#fff" />
              </View>
              {i < steps.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
            </View>
            <Pressable
              disabled={!s.onPress}
              onPress={s.onPress}
              style={({ pressed }) => [
                styles.stepCard,
                colors.shadow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  transform: [{ scale: pressed && s.onPress ? 0.99 : 1 }],
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.stepTitleRow}>
                  <Text style={[styles.stepTitle, { color: colors.foreground }]}>{s.title}</Text>
                  {s.time ? <Text style={[styles.stepTime, { color: s.tone === "warn" ? colors.gold : colors.primary }]}>{s.time}</Text> : null}
                </View>
                <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>{s.sub}</Text>
                {s.cta ? (
                  <View style={styles.stepCtaRow}>
                    <Text style={[styles.stepCta, { color: colors.primary }]}>{s.cta}</Text>
                    <Icon name="chevron-right" size={15} color={colors.primary} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <Text style={[styles.foot, { color: colors.mutedForeground }]}>
        Times shown in the airport's local clock. HOLTO keeps watching this flight and will alert you if anything changes.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  h1: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.4, marginBottom: 16 },
  hero: { padding: 20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroFlight: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff", letterSpacing: 0.5 },
  heroRoute: { fontFamily: "Inter_500Medium", fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  heroTimes: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  heroTimeLabel: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 },
  heroTime: { fontFamily: "Inter_700Bold", fontSize: 30, color: "#fff", letterSpacing: -0.5, marginTop: 2 },
  heroHeadline: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, color: "rgba(255,255,255,0.85)", marginTop: 16 },
  heroFallback: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16, color: "rgba(255,255,255,0.5)", marginTop: 8 },
  rescueBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, marginTop: 12 },
  rescueText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  stepRow: { flexDirection: "row", gap: 14 },
  rail: { alignItems: "center", width: 26 },
  node: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  stepCard: { flex: 1, borderWidth: 1, padding: 14, marginBottom: 12 },
  stepTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  stepTime: { fontFamily: "Inter_700Bold", fontSize: 16 },
  stepSub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, marginTop: 3 },
  stepCtaRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 8 },
  stepCta: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  emptyCard: { alignItems: "center", borderWidth: 1, padding: 28, marginTop: 20, gap: 10 },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  emptySub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  emptyBtn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  foot: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 20 },
});
