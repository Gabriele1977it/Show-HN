import { Icon } from "@/components/Icon";
import {
  customFetch,
  getListDisruptionsQueryKey,
  getListMonitoredFlightsQueryKey,
  useAddMonitoredFlight,
  useListDisruptions,
  useListMonitoredFlights,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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

import AskHoltoSheet from "@/components/AskHoltoSheet";
import { DisruptionCard } from "@/components/DisruptionCard";
import { HoltoLogo } from "@/components/HoltoLogo";
import { RetryError } from "@/components/RetryError";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import { AddToTripSheet } from "@/components/AddToTripSheet";
import { InstallPrompt } from "@/components/InstallPrompt";
import { WhatsNewSheet } from "@/components/WhatsNewSheet";
import { SkeletonCard } from "@/components/Skeleton";

const TOOLKIT: { emoji: string; label: string; route: string }[] = [
  { emoji: "🗓️", label: "Travel day", route: "/today" },
  { emoji: "🧭", label: "Destination", route: "/destination" },
  { emoji: "🧾", label: "Expenses", route: "/expenses" },
  { emoji: "⏱️", label: "Airport", route: "/airport-timing" },
  { emoji: "💱", label: "Currency", route: "/currency" },
  { emoji: "🌇", label: "Best light", route: "/shoot-times" },
  { emoji: "🌍", label: "Residency", route: "/residency" },
  { emoji: "💷", label: "Cost of living", route: "/cost-of-living" },
];

type FlightStatus = "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted" | "unknown";

interface FlightResult {
  flightNumber: string;
  airlineIata: string | null;
  status: FlightStatus;
  depAirport: string | null;
  arrAirport: string | null;
  scheduledDep: string | null;
  scheduledArr: string | null;
  estimatedDep: string | null;
  estimatedArr: string | null;
  depDelay: number | null;
  arrDelay: number | null;
  depGate: string | null;
  depTerminal: string | null;
  companionMessage: string | null;
}

interface JourneyFlight {
  flightNumber: string | null;
  title: string;
  depAirport: string | null;
  arrAirport: string | null;
  scheduledDep: string | null;
  estimatedDep: string | null;
  status: FlightStatus;
  depGate: string | null;
  depTerminal: string | null;
  depDelay: number | null;
}
interface JourneyResponse {
  hasFlight: boolean;
  flight?: JourneyFlight;
}

function statusLabel(s: FlightStatus) {
  return { scheduled: "Scheduled", active: "In Air", landed: "Landed", cancelled: "Cancelled", incident: "Incident", diverted: "Diverted", unknown: "Unknown" }[s] ?? "Unknown";
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

function formatFlightTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(11, 16) || "—";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "—";
  }
}

function formatFlightDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function airlineFullName(iata: string | null): string {
  const map: Record<string, string> = {
    EZY: "easyJet", BA: "British Airways", FR: "Ryanair", W6: "Wizz Air",
    TK: "Turkish Airlines", LH: "Lufthansa", AF: "Air France", KL: "KLM",
    MS: "EgyptAir", PC: "Pegasus", U2: "easyJet", EK: "Emirates",
    QR: "Qatar Airways", EY: "Etihad", SU: "Aeroflot",
  };
  return iata ? (map[iata] ?? iata) : "";
}

function FlightResultCard({
  result,
  onTrack,
  tracked,
  tracking,
  colors,
  onWhenToLeave,
  onAddToTrip,
}: {
  result: FlightResult;
  onTrack: () => void;
  tracked: boolean;
  tracking: boolean;
  colors: ReturnType<typeof useColors>;
  onWhenToLeave: () => void;
  onAddToTrip: () => void;
}) {
  const depDate = formatFlightDate(result.scheduledDep);
  const depTime = formatFlightTime(result.scheduledDep);
  const arrTime = formatFlightTime(result.scheduledArr);
  const airline = airlineFullName(result.airlineIata);

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View style={[styles.flightCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.flightCardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.flightNum, { color: colors.foreground }]}>
              {result.flightNumber}
            </Text>
            {airline ? (
              <Text style={[styles.airlineName, { color: colors.mutedForeground }]}>{airline}</Text>
            ) : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(result.status) + "22" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(result.status) }]} />
            <Text style={[styles.statusText, { color: statusColor(result.status) }]}>
              {statusLabel(result.status)}
            </Text>
          </View>
        </View>

        {(result.depAirport || result.arrAirport) && (
          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <Text style={[styles.routeCode, { color: colors.foreground }]}>{result.depAirport ?? "—"}</Text>
              <Text style={[styles.routeTime, { color: colors.primary }]}>{depTime}</Text>
            </View>
            <View style={styles.routeLine}>
              <View style={[styles.routeDash, { backgroundColor: colors.border }]} />
              <Icon name="send" size={12} color={colors.mutedForeground} style={{ marginHorizontal: 4 }} />
              <View style={[styles.routeDash, { backgroundColor: colors.border }]} />
            </View>
            <View style={[styles.routePoint, { alignItems: "flex-end" }]}>
              <Text style={[styles.routeCode, { color: colors.foreground }]}>{result.arrAirport ?? "—"}</Text>
              <Text style={[styles.routeTime, { color: colors.primary }]}>{arrTime}</Text>
            </View>
          </View>
        )}

        {depDate ? (
          <Text style={[styles.depDate, { color: colors.mutedForeground }]}>{depDate}</Text>
        ) : null}

        {result.depGate ? (
          <Text style={[styles.gateText, { color: colors.mutedForeground }]}>
            Gate {result.depGate}{result.depTerminal ? ` · Terminal ${result.depTerminal}` : ""}
          </Text>
        ) : null}

        {result.companionMessage ? (
          <View style={[styles.aiBox, { backgroundColor: colors.primary + "12" }]}>
            <Text style={[styles.aiText, { color: colors.foreground }]}>
              💬 {result.companionMessage}
            </Text>
          </View>
        ) : null}

        {tracked ? (
          <View style={[styles.trackedRow, { backgroundColor: "#2E7D5215" }]}>
            <Icon name="check-circle" size={15} color="#2E7D52" />
            <Text style={[styles.trackedText, { color: "#2E7D52" }]}>
              Tracking — check "My Flight" tab for live updates
            </Text>
          </View>
        ) : (
          <View style={styles.flightActions}>
            <Pressable
              onPress={onTrack}
              disabled={tracking}
              style={[styles.trackBtn, { backgroundColor: colors.primary }]}
            >
              {tracking ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="radio" size={14} color="#fff" />
                  <Text style={styles.trackBtnText}>Track this flight</Text>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={() => router.push("/disruption/wizard")}
              style={[styles.issueBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.issueBtnText, { color: colors.mutedForeground }]}>Report an issue</Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.linkRow, { borderTopColor: colors.border }]}>
          <Pressable onPress={onWhenToLeave} style={styles.linkBtn} hitSlop={6}>
            <Text style={{ fontSize: 13 }}>⏱️</Text>
            <Text style={[styles.linkText, { color: colors.primary }]}>When to leave?</Text>
          </Pressable>
          <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />
          <Pressable onPress={onAddToTrip} style={styles.linkBtn} hitSlop={6}>
            <Text style={{ fontSize: 13 }}>🧳</Text>
            <Text style={[styles.linkText, { color: colors.primary }]}>Add to trip</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, logout } = useAuth();

  const [askVisible, setAskVisible] = useState(false);
  const [flightInput, setFlightInput] = useState("");
  const [flightResult, setFlightResult] = useState<FlightResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [addTripOpen, setAddTripOpen] = useState(false);

  const handleWhenToLeave = useCallback(() => {
    if (!flightResult) return;
    let date = "";
    let time = "";
    if (flightResult.scheduledDep) {
      const d = new Date(flightResult.scheduledDep);
      if (!isNaN(d.getTime())) {
        date = d.toISOString().slice(0, 10);
        time = d.toISOString().slice(11, 16);
      }
    }
    const airport = flightResult.depAirport ?? "";
    router.push(`/airport-timing?airport=${encodeURIComponent(airport)}&date=${date}&time=${time}` as never);
  }, [flightResult]);
  const [tracked, setTracked] = useState(false);
  const [tracking, setTracking] = useState(false);

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  const { data: disruptions, isLoading, isError, refetch, isRefetching } = useListDisruptions({
    query: { queryKey: getListDisruptionsQueryKey() },
  });

  const { mutateAsync: addMonitored } = useAddMonitoredFlight();

  // Surface tracked flights on Home so HOLTO is useful *before* anything goes
  // wrong — a calm at-a-glance status every trip.
  const { data: monitored = [] } = useListMonitoredFlights({
    query: { queryKey: getListMonitoredFlightsQueryKey() },
  });

  // The next upcoming flight from the user's trips, for the "travel day" hero.
  const { data: journey } = useQuery({
    queryKey: ["journey-next"],
    queryFn: () => customFetch<JourneyResponse>("/api/journey/next"),
    staleTime: 60_000,
  });

  const handleDeleteDisruption = useCallback(
    async (id: number) => {
      try {
        await customFetch(`/api/disruptions/${id}`, { method: "DELETE" });
        await refetch();
      } catch {
        // silent
      }
    },
    [refetch],
  );

  // Coerce to arrays: a non-array payload (e.g. a stray HTML 200 before the
  // API base URL is set) must never crash Home with `.map`/`.slice`.
  const disruptionList = Array.isArray(disruptions) ? disruptions : [];
  const monitoredList = Array.isArray(monitored) ? monitored : [];
  const recent = disruptionList.slice(0, 3);

  // Surface the "travel day" hero only when a flight is close (within 24h) and
  // still ahead of the traveller — otherwise it's just noise on Home.
  const journeyFlight = journey?.hasFlight ? journey.flight : undefined;
  const showTravelDay = (() => {
    if (!journeyFlight?.scheduledDep) return false;
    if (journeyFlight.status === "landed") return false;
    const dep = new Date(journeyFlight.scheduledDep).getTime();
    if (isNaN(dep)) return false;
    const hoursAway = (dep - Date.now()) / 3_600_000;
    return hoursAway <= 24;
  })();

  const handleSearch = async () => {
    const fn = flightInput.trim().toUpperCase();
    if (!fn) return;
    setSearching(true);
    setSearchError(null);
    setFlightResult(null);
    setTracked(false);
    try {
      const data = await customFetch<FlightResult>(
        `/api/flights/status?flightNumber=${encodeURIComponent(fn)}`,
      );
      setFlightResult(data);
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string; requiresUpgrade?: boolean } }).data;
      if (body?.requiresUpgrade) {
        setUpgrade(body.error ?? "Upgrade for unlimited flight tracking.");
      } else {
        setSearchError(body?.error ?? "Flight not found. Check the number and try again.");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleTrack = async () => {
    if (!flightResult) return;
    setTracking(true);
    try {
      await addMonitored({
        data: {
          flightNumber: flightResult.flightNumber,
          destination: flightResult.arrAirport ?? "UNK",
        },
      });
      setTracked(true);
    } catch {
      // silently fail — user can add manually from Monitor tab
    } finally {
      setTracking(false);
    }
  };

  const greeting = (() => {
    const h = new Date().getHours();
    const name = user?.name?.split(" ")[0] ?? "";
    const g = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return name ? `${g}, ${name}` : g;
  })();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 8, paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <HoltoLogo size="large" />
          <Pressable
            onPress={logout}
            style={({ pressed }) => [styles.logoutBtn, { opacity: pressed ? 0.55 : 1 }]}
            accessibilityLabel="Sign out"
          >
            <Icon name="log-out" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(450)} style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>{greeting}</Text>
          <Text style={[styles.greetingSub, { color: colors.mutedForeground }]}>
            Your travel companion. Let's check your flight.
          </Text>
        </Animated.View>

        <InstallPrompt />
        <WhatsNewSheet />

        {showTravelDay && journeyFlight && (
          <Animated.View entering={FadeInDown.delay(40).duration(450)}>
            <Pressable
              onPress={() => router.push("/today" as never)}
              style={({ pressed }) => [
                styles.travelDayCard,
                colors.shadow,
                { backgroundColor: colors.midnight, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.99 : 1 }] },
              ]}
              accessibilityRole="button"
            >
              <View style={styles.travelDayHead}>
                <View style={[styles.travelDayDot, { backgroundColor: colors.gold }]} />
                <Text style={styles.travelDayEyebrow}>TODAY'S JOURNEY</Text>
              </View>
              <View style={styles.travelDayBody}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.travelDayFlight}>
                    {journeyFlight.flightNumber ?? journeyFlight.title}
                  </Text>
                  <Text style={styles.travelDayRoute}>
                    {(journeyFlight.depAirport ?? "—")} → {(journeyFlight.arrAirport ?? "—")}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.travelDayTimeLabel}>DEPARTS</Text>
                  <Text style={styles.travelDayTime}>
                    {formatFlightTime(journeyFlight.estimatedDep ?? journeyFlight.scheduledDep)}
                  </Text>
                </View>
              </View>
              <View style={styles.travelDayFooter}>
                <Text style={styles.travelDayNote}>
                  {journeyFlight.depDelay && journeyFlight.depDelay >= 15
                    ? `Delayed ~${journeyFlight.depDelay} min`
                    : journeyFlight.depGate
                      ? `Gate ${journeyFlight.depGate}${journeyFlight.depTerminal ? ` · T${journeyFlight.depTerminal}` : ""}`
                      : "See your full travel-day plan"}
                </Text>
                <View style={styles.travelDayCta}>
                  <Text style={styles.travelDayCtaText}>Open</Text>
                  <Icon name="arrow-right" size={13} color={colors.gold} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(80).duration(450)}>
          <LinearGradient
            colors={["#0A2E38", "#0E3F50"]}
            style={[styles.trackerCard, { borderRadius: colors.radius }]}
          >
            <Text style={styles.trackerLabel}>Track a flight</Text>
            <Text style={styles.trackerSub}>Enter your flight number for live status</Text>

            <View style={styles.searchRow}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: "rgba(255,255,255,0.1)", color: "#fff" }]}
                placeholder="e.g. EZY8743"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={flightInput}
                onChangeText={(t) => {
                  setFlightInput(t);
                  if (flightResult) {
                    setFlightResult(null);
                    setTracked(false);
                    setSearchError(null);
                  }
                }}
                autoCapitalize="characters"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                selectionColor="rgba(63,181,196,0.8)"
              />
              <Pressable
                onPress={handleSearch}
                disabled={searching || !flightInput.trim()}
                style={[
                  styles.searchBtn,
                  { backgroundColor: colors.teal, opacity: searching || !flightInput.trim() ? 0.5 : 1 },
                ]}
              >
                {searching ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Icon name="search" size={18} color="#fff" />
                )}
              </Pressable>
            </View>

            {searchError ? (
              <View style={styles.searchErrorBox}>
                <Icon name="alert-circle" size={13} color="#F87171" />
                <Text style={styles.searchErrorText}>{searchError}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </Animated.View>

        {/* Toolkit quick-access — surfaces the tools so they're discoverable */}
        <Animated.View entering={FadeInDown.delay(90).duration(450)} style={styles.toolkitWrap}>
          <View style={styles.toolkitHeader}>
            <Text style={[styles.toolkitTitle, { color: colors.foreground }]}>Your toolkit</Text>
            <Pressable onPress={() => router.push("/(tabs)/tools")} hitSlop={6}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>All tools</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
            {TOOLKIT.map((t) => (
              <Pressable
                key={t.route}
                onPress={() => router.push(t.route as never)}
                style={({ pressed }) => [
                  styles.toolPill,
                  colors.shadow,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
                <Text style={[styles.toolPillText, { color: colors.foreground }]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {flightResult && (
          <View style={{ marginTop: 12 }}>
            <FlightResultCard
              result={flightResult}
              onTrack={handleTrack}
              tracked={tracked}
              tracking={tracking}
              colors={colors}
              onWhenToLeave={handleWhenToLeave}
              onAddToTrip={() => setAddTripOpen(true)}
            />
          </View>
        )}

        {!flightResult && (
          <Animated.View entering={FadeInDown.delay(100).duration(450)}>
            <Pressable
              style={({ pressed }) => [
                styles.disruptionCta,
                colors.shadow,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.985 : 1 }] },
              ]}
              onPress={() => router.push("/trips")}
              accessibilityRole="button"
            >
              <View style={[styles.ctaIcon, { backgroundColor: colors.gold + "22", borderRadius: 10 }]}>
                <Text style={{ fontSize: 18 }}>🧳</Text>
              </View>
              <View style={styles.ctaText}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Your trips</Text>
                <Text style={[styles.ctaDesc, { color: colors.mutedForeground }]}>
                  Flights, hotels and plans in one timeline
                </Text>
              </View>
              <Icon name="chevron-right" size={17} color={colors.mutedForeground} />
            </Pressable>
          </Animated.View>
        )}

        {monitoredList.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your flights</Text>
              <Pressable onPress={() => router.push("/(tabs)/monitor")}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>Manage</Text>
              </Pressable>
            </View>
            {monitoredList.slice(0, 3).map((m) => {
              const st = (m.lastStatus as FlightStatus | null) ?? "unknown";
              const known = !!m.lastStatus;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => router.push("/(tabs)/monitor")}
                  style={({ pressed }) => [
                    styles.flightRow,
                    colors.shadow,
                    { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.99 : 1 }] },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.flightRowNum, { color: colors.foreground }]}>{m.flightNumber}</Text>
                    <Text style={[styles.flightRowDest, { color: colors.mutedForeground }]}>→ {m.destination}</Text>
                  </View>
                  {known ? (
                    <View style={[styles.flightRowBadge, { backgroundColor: statusColor(st) + "1A" }]}>
                      <Text style={[styles.flightRowBadgeText, { color: statusColor(st) }]}>{statusLabel(st)}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.flightRowWatching, { color: colors.mutedForeground }]}>Watching…</Text>
                  )}
                  <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {!flightResult && (
          <Animated.View entering={FadeInDown.delay(160).duration(450)}>
            <Pressable
              style={({ pressed }) => [
                styles.disruptionCta,
                colors.shadow,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, transform: [{ scale: pressed ? 0.985 : 1 }] },
              ]}
              onPress={() => router.push("/disruption/wizard")}
              accessibilityRole="button"
            >
              <View style={[styles.ctaIcon, { backgroundColor: colors.teal + "20", borderRadius: 10 }]}>
                <Icon name="alert-circle" size={19} color={colors.teal} />
              </View>
              <View style={styles.ctaText}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>Had a disruption?</Text>
                <Text style={[styles.ctaDesc, { color: colors.mutedForeground }]}>
                  Delay · Cancellation · Missed connection · Denied boarding
                </Text>
              </View>
              <Icon name="chevron-right" size={17} color={colors.mutedForeground} />
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(240).duration(450)} style={{ marginTop: 16 }}>
          <Pressable
            onPress={() => openUrl("https://holtotravel.com")}
            style={[styles.ecosystemCard, { backgroundColor: colors.midnight, borderRadius: colors.radius }]}
          >
            <View style={styles.ecosystemTop}>
              <View>
                <Text style={styles.ecosystemEyebrow}>HOLTO LIVING</Text>
                <Text style={styles.ecosystemTitle}>Planning life abroad?</Text>
              </View>
              <View style={[styles.ecosystemDot, { backgroundColor: colors.gold }]} />
            </View>
            <Text style={styles.ecosystemBody}>
              Expert guides on relocating, long stays, and living well in Egypt, the Red Sea and beyond. Built for people who want more than a holiday.
            </Text>
            <View style={styles.ecosystemFooter}>
              <Text style={styles.ecosystemLink}>Visit holtotravel.com</Text>
              <Icon name="arrow-right" size={13} color="rgba(255,255,255,0.5)" />
            </View>
          </Pressable>
        </Animated.View>

        {isLoading && (
          <View style={{ marginTop: 24 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        )}

        {isError && !isLoading && (
          <RetryError message="Couldn't load your disruptions." onRetry={refetch} />
        )}

        {!isLoading && !isError && recent.length > 0 && (
          <Animated.View entering={FadeInDown.delay(320).duration(450)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent disruptions</Text>
              {disruptionList.length > 3 && (
                <Pressable onPress={() => router.push("/(tabs)/history")}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
                </Pressable>
              )}
            </View>
            {recent.map((d) => <DisruptionCard key={d.id} disruption={d} onDelete={handleDeleteDisruption} />)}
          </Animated.View>
        )}

        <Animated.View
          entering={FadeInDown.delay(400).duration(450)}
          style={[styles.trustNote, { backgroundColor: colors.muted, borderRadius: colors.radius }]}
        >
          <Icon name="shield" size={11} color={colors.mutedForeground} />
          <Text style={[styles.trustText, { color: colors.mutedForeground }]}>
            HOLTO provides guidance, not legal advice. Always verify your rights with your airline or the CAA.
          </Text>
        </Animated.View>
      </ScrollView>

      <Pressable
        onPress={() => setAskVisible(true)}
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: (Platform.OS === "ios" ? insets.bottom : 16) + 72,
          },
        ]}
        accessibilityLabel="Ask HOLTO"
        accessibilityRole="button"
      >
        <Icon name="message-circle" size={19} color="#fff" />
        <Text style={styles.fabLabel}>Ask HOLTO</Text>
      </Pressable>

      <AskHoltoSheet visible={askVisible} onClose={() => setAskVisible(false)} />
      <UpgradeSheet
        visible={!!upgrade}
        message={upgrade ?? undefined}
        title="Unlimited flight tracking"
        onClose={() => setUpgrade(null)}
      />
      <AddToTripSheet
        visible={addTripOpen}
        flight={flightResult}
        onClose={() => setAddTripOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 8,
  },
  logoutBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  greetingBlock: { marginBottom: 20 },
  greeting: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3, marginBottom: 3 },
  greetingSub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  travelDayCard: { padding: 18, marginBottom: 14 },
  travelDayHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
  travelDayDot: { width: 7, height: 7, borderRadius: 4 },
  travelDayEyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 1.4, color: "rgba(255,255,255,0.55)" },
  travelDayBody: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  travelDayFlight: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff", letterSpacing: 0.4 },
  travelDayRoute: { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  travelDayTimeLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1, color: "rgba(255,255,255,0.45)" },
  travelDayTime: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff", letterSpacing: -0.5, marginTop: 1 },
  travelDayFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 12 },
  travelDayNote: { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.75)", flex: 1 },
  travelDayCta: { flexDirection: "row", alignItems: "center", gap: 4 },
  travelDayCtaText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#C9A24B" },
  trackerCard: { padding: 20, marginBottom: 14 },
  toolkitWrap: { marginTop: 6, marginBottom: 4 },
  toolkitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  toolkitTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  toolPill: { width: 96, alignItems: "center", gap: 8, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 8 },
  toolPillText: { fontFamily: "Inter_600SemiBold", fontSize: 12, textAlign: "center" },
  trackerLabel: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff", marginBottom: 4 },
  trackerSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 16 },
  searchRow: { flexDirection: "row", gap: 10 },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  searchErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  searchErrorText: { color: "#F87171", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  flightCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  flightCardTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  flightNum: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 0.5 },
  airlineName: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  routePoint: { flex: 1 },
  routeLine: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, flex: 1, justifyContent: "center" },
  routeDash: { height: 1, flex: 1 },
  routeCode: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: 1 },
  routeTime: { fontFamily: "Inter_600SemiBold", fontSize: 16, marginTop: 2 },
  depDate: { fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 4 },
  gateText: { fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 10 },
  aiBox: { borderRadius: 10, padding: 12, marginBottom: 12 },
  aiText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  flightActions: { flexDirection: "row", gap: 10 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderTopWidth: 1, marginTop: 14, paddingTop: 12 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4 },
  linkText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  linkDivider: { width: 1, height: 18 },
  trackBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 42,
    borderRadius: 10,
  },
  trackBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  issueBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  issueBtnText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  trackedRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  trackedText: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
  disruptionCta: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderWidth: 1,
    marginBottom: 0,
  },
  ctaIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ctaText: { flex: 1 },
  ctaTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, marginBottom: 2 },
  ctaDesc: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17 },
  ecosystemCard: { padding: 20, marginBottom: 0 },
  ecosystemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  ecosystemEyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  ecosystemTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  ecosystemDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  ecosystemBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 20,
    marginBottom: 14,
  },
  ecosystemFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
  ecosystemLink: { fontFamily: "Inter_500Medium", fontSize: 13, color: "rgba(255,255,255,0.5)" },
  loadingWrap: { paddingVertical: 32, alignItems: "center" },
  section: { marginTop: 24, marginBottom: 8 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  seeAll: { fontFamily: "Inter_500Medium", fontSize: 14 },
  flightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  flightRowNum: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  flightRowDest: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  flightRowBadge: { borderRadius: 40, paddingHorizontal: 10, paddingVertical: 4 },
  flightRowBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  flightRowWatching: { fontFamily: "Inter_500Medium", fontSize: 12 },
  trustNote: { flexDirection: "row", alignItems: "flex-start", gap: 7, padding: 12, marginTop: 20 },
  trustText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 26,
    elevation: 5,
  },
  fabLabel: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
