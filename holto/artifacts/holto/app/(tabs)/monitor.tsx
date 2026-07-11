import { getListMonitoredFlightsQueryKey, useAddMonitoredFlight, useListMonitoredFlights, useRemoveMonitoredFlight } from "@workspace/api-client-react";
import { Icon } from "@/components/Icon";
import { UpgradeSheet } from "@/components/UpgradeSheet";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const POLL_INTERVAL_MS = 15 * 60 * 1000;

type FlightStatus = "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted" | "unknown";

function statusLabel(s: FlightStatus): string {
  return { scheduled: "Scheduled", active: "In Air", landed: "Landed", cancelled: "Cancelled", incident: "Incident", diverted: "Diverted", unknown: "Unknown" }[s] ?? "Unknown";
}

function statusBg(s: FlightStatus, colors: ReturnType<typeof useColors>): string {
  switch (s) {
    case "active": return colors.primary;
    case "landed": return "#2E7D52";
    case "cancelled": return "#C0392B";
    case "incident":
    case "diverted": return "#C9A24B";
    default: return colors.mutedForeground;
  }
}

function DelayBadge({ minutes, colors }: { minutes: number | null | undefined; colors: ReturnType<typeof useColors> }) {
  if (minutes == null || minutes === 0) return null;
  const isPositive = minutes > 0;
  return (
    <View style={[styles.delayBadge, { backgroundColor: isPositive ? "#C0392B22" : "#2E7D5222" }]}>
      <Text style={[styles.delayText, { color: isPositive ? "#C0392B" : "#2E7D52" }]}>
        {isPositive ? `+${minutes}` : `${minutes}`} min
      </Text>
    </View>
  );
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso.slice(11, 16) || "—";
  }
}

function CountdownText({ nextCheckAt, colors }: { nextCheckAt: number; colors: ReturnType<typeof useColors> }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.floor((nextCheckAt - Date.now()) / 1000));
      setRemaining(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextCheckAt]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const label = remaining === 0 ? "Checking…" : `Next update in ${m}:${String(s).padStart(2, "0")}`;

  return (
    <Text style={[styles.countdown, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

export default function MonitorScreen() {
  const colors = useColors();
  const { token } = useAuth();

  const [flightInput, setFlightInput] = useState("");
  const [destInput, setDestInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const [activeFlightId, setActiveFlightId] = useState<number | null>(null);
  const [activeFlightNumber, setActiveFlightNumber] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<Record<string, unknown> | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [nextCheckAt, setNextCheckAt] = useState<number>(Date.now() + POLL_INTERVAL_MS);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: monitored = [], refetch: refetchList, isLoading: listLoading, isRefetching } = useListMonitoredFlights({
    query: { queryKey: getListMonitoredFlightsQueryKey(), enabled: !!token },
  });

  const { mutateAsync: addFlight, isPending: adding } = useAddMonitoredFlight();
  const { mutateAsync: removeFlight } = useRemoveMonitoredFlight();

  const fetchStatus = useCallback(async (flightNum: string) => {
    if (!flightNum) return;
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch(
        `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/flights/status?flightNumber=${encodeURIComponent(flightNum)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setStatusError((data.error as string) ?? "Could not fetch flight status.");
        return;
      }
      setLiveStatus(data);
      setLastCheckedAt(new Date());
      setNextCheckAt(Date.now() + POLL_INTERVAL_MS);

      const newStatus = data.status as string;
      if (prevStatus && prevStatus !== newStatus && Platform.OS !== "web") {
        const isProblematic = ["cancelled", "incident", "diverted"].includes(newStatus);
        if (isProblematic) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      setPrevStatus(newStatus);
    } catch {
      setStatusError("Connection error. Check your network and try again.");
    } finally {
      setLoadingStatus(false);
    }
  }, [token, prevStatus]);

  useEffect(() => {
    if (!activeFlightNumber) return;
    fetchStatus(activeFlightNumber);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchStatus(activeFlightNumber), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeFlightNumber]);

  useEffect(() => {
    if (monitored.length > 0 && !activeFlightId) {
      const first = monitored[0];
      setActiveFlightId(first.id);
      setActiveFlightNumber(first.flightNumber);
    }
  }, [monitored]);

  const handleAdd = async () => {
    const fn = flightInput.trim().toUpperCase();
    const dest = destInput.trim().toUpperCase();
    if (!fn || !dest) {
      setFormError("Enter a flight number and destination airport code.");
      return;
    }
    setFormError(null);
    try {
      const result = await addFlight({ data: { flightNumber: fn, destination: dest } });
      await refetchList();
      setFlightInput("");
      setDestInput("");
      setActiveFlightId(result.id);
      setActiveFlightNumber(result.flightNumber);
      setLiveStatus(null);
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string; requiresUpgrade?: boolean } }).data;
      if (body?.requiresUpgrade) {
        setUpgrade(body.error ?? "Live flight monitoring is a paid feature.");
      } else {
        setFormError(body?.error ?? "Could not add this flight. Please try again.");
      }
    }
  };

  const handleRemove = async (id: number) => {
    Alert.alert("Stop tracking?", "You'll no longer receive status updates for this flight.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop tracking",
        style: "destructive",
        onPress: async () => {
          try {
            await removeFlight({ id });
            await refetchList();
            if (id === activeFlightId) {
              setActiveFlightId(null);
              setActiveFlightNumber(null);
              setLiveStatus(null);
              setStatusError(null);
              if (pollRef.current) clearInterval(pollRef.current);
            }
          } catch {
            Alert.alert("Error", "Could not remove this flight.");
          }
        },
      },
    ]);
  };

  const handleSelectFlight = (flight: { id: number; flightNumber: string }) => {
    if (flight.id === activeFlightId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    setActiveFlightId(flight.id);
    setActiveFlightNumber(flight.flightNumber);
    setLiveStatus(null);
    setStatusError(null);
    setPrevStatus(null);
  };

  const status = liveStatus?.status as FlightStatus | undefined;
  const depDelay = liveStatus?.depDelay as number | null | undefined;
  const arrDelay = liveStatus?.arrDelay as number | null | undefined;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchList}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.foreground }]}>My Flight</Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            Live status — HOLTO keeps watching in the background
          </Text>
        </View>

        {listLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !Array.isArray(monitored) || monitored.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name="radio" size={32} color={colors.mutedForeground} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No flight tracked yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              Enter your flight details below and HOLTO will watch it for you —
              even when the app is closed — and alert you the moment anything changes.
            </Text>
          </View>
        ) : (
          <>
            {monitored.map((m) => {
              const isActive = m.id === activeFlightId;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.flightChipRow,
                    {
                      backgroundColor: isActive ? colors.primary + "22" : colors.card,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => handleSelectFlight(m)}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.chipFlight, { color: isActive ? colors.primary : colors.foreground }]}>
                        {m.flightNumber}
                      </Text>
                      <Text style={[styles.chipDest, { color: colors.mutedForeground }]}>→ {m.destination}</Text>
                    </View>
                    {m.lastStatus ? (
                      <View style={[styles.chipStatus, { backgroundColor: statusBg(m.lastStatus as FlightStatus, colors) + "33" }]}>
                        <Text style={[styles.chipStatusText, { color: statusBg(m.lastStatus as FlightStatus, colors) }]}>
                          {statusLabel(m.lastStatus as FlightStatus)}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemove(m.id)}
                    hitSlop={16}
                    style={styles.removeBtn}
                  >
                    <Icon name="x" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              );
            })}

            {activeFlightNumber && (
              <View style={[styles.statusCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statusCardHeader}>
                  <Text style={[styles.statusFlight, { color: colors.foreground }]}>{activeFlightNumber}</Text>
                  {status && (
                    <View style={[styles.statusBadge, { backgroundColor: statusBg(status, colors) }]}>
                      <Text style={styles.statusBadgeText}>{statusLabel(status)}</Text>
                    </View>
                  )}
                  <Pressable
                    onPress={() => fetchStatus(activeFlightNumber)}
                    disabled={loadingStatus}
                    style={[styles.refreshBtn, { borderColor: colors.border }]}
                  >
                    {loadingStatus ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Icon name="refresh-cw" size={15} color={colors.primary} />
                    )}
                  </Pressable>
                </View>

                {liveStatus && (
                  <>
                    {(liveStatus.depAirport || liveStatus.arrAirport) ? (
                      <Text style={[styles.route, { color: colors.mutedForeground }]}>
                        {liveStatus.depAirport as string ?? "—"} → {liveStatus.arrAirport as string ?? "—"}
                      </Text>
                    ) : null}

                    <View style={styles.timesRow}>
                      <View style={styles.timeCol}>
                        <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Departure</Text>
                        <Text style={[styles.timeValue, { color: colors.foreground }]}>
                          {formatTime(liveStatus.scheduledDep as string)}
                        </Text>
                        {liveStatus.estimatedDep && liveStatus.estimatedDep !== liveStatus.scheduledDep ? (
                          <Text style={[styles.timeEst, { color: colors.primary }]}>
                            Est. {formatTime(liveStatus.estimatedDep as string)}
                          </Text>
                        ) : null}
                        <DelayBadge minutes={depDelay} colors={colors} />
                        {liveStatus.depGate ? (
                          <Text style={[styles.gateLine, { color: colors.mutedForeground }]}>
                            Gate {liveStatus.depGate as string}
                            {liveStatus.depTerminal ? ` · T${liveStatus.depTerminal as string}` : ""}
                          </Text>
                        ) : null}
                      </View>
                      <Icon name="arrow-right" size={16} color={colors.mutedForeground} style={{ marginTop: 20 }} />
                      <View style={styles.timeCol}>
                        <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Arrival</Text>
                        <Text style={[styles.timeValue, { color: colors.foreground }]}>
                          {formatTime(liveStatus.scheduledArr as string)}
                        </Text>
                        {liveStatus.estimatedArr && liveStatus.estimatedArr !== liveStatus.scheduledArr ? (
                          <Text style={[styles.timeEst, { color: colors.primary }]}>
                            Est. {formatTime(liveStatus.estimatedArr as string)}
                          </Text>
                        ) : null}
                        <DelayBadge minutes={arrDelay} colors={colors} />
                        {liveStatus.arrTerminal ? (
                          <Text style={[styles.gateLine, { color: colors.mutedForeground }]}>
                            T{liveStatus.arrTerminal as string}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {liveStatus.companionMessage ? (
                      <View style={[styles.aiBox, { backgroundColor: colors.primary + "15" }]}>
                        <Icon name="message-circle" size={14} color={colors.primary} style={{ marginRight: 6, marginTop: 1 }} />
                        <Text style={[styles.aiText, { color: colors.foreground }]}>
                          {liveStatus.companionMessage as string}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.footerRow}>
                      {lastCheckedAt && (
                        <Text style={[styles.lastChecked, { color: colors.mutedForeground }]}>
                          Updated {lastCheckedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      )}
                      <CountdownText nextCheckAt={nextCheckAt} colors={colors} />
                    </View>
                  </>
                )}

                {statusError && !liveStatus && (
                  <Text style={[styles.errorText, { color: "#C0392B" }]}>{statusError}</Text>
                )}

                {!liveStatus && !statusError && loadingStatus && (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Checking flight status…</Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.addTitle, { color: colors.foreground }]}>
            {monitored.length === 0 ? "Track a flight" : "Track another"}
          </Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Flight number (e.g. BA245)"
            placeholderTextColor={colors.mutedForeground}
            value={flightInput}
            onChangeText={setFlightInput}
            autoCapitalize="characters"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Destination airport (e.g. HRG)"
            placeholderTextColor={colors.mutedForeground}
            value={destInput}
            onChangeText={setDestInput}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleAdd}
          />
          <Pressable
            onPress={handleAdd}
            disabled={adding}
            style={[styles.addBtn, { backgroundColor: colors.primary, opacity: adding ? 0.6 : 1 }]}
          >
            {adding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addBtnText}>Start tracking</Text>
            )}
          </Pressable>
          {formError && (
            <Text style={{ color: colors.destructive, fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 10 }}>
              {formError}
            </Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      <UpgradeSheet
        visible={!!upgrade}
        message={upgrade ?? undefined}
        title="Live flight monitoring"
        onClose={() => setUpgrade(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 60 },
  header: { marginBottom: 24 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subheading: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginBottom: 8, textAlign: "center" },
  emptyBody: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  flightChipRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  removeBtn: {
    padding: 6,
    marginLeft: 6,
    borderRadius: 8,
  },
  chipFlight: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  chipDest: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  chipStatus: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  chipStatusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    marginTop: 8,
  },
  statusCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  statusFlight: { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  route: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  timesRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  timeCol: { flex: 1 },
  timeLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  timeValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  timeEst: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  gateLine: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
  delayBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, marginTop: 4, alignSelf: "flex-start" },
  delayText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  aiBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  aiText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastChecked: { fontSize: 11, fontFamily: "Inter_400Regular" },
  countdown: { fontSize: 11, fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 8 },
  loadingBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  addCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    marginTop: 8,
  },
  addTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  addBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
