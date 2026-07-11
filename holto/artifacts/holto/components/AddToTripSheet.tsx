import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

export interface FlightForTrip {
  flightNumber: string;
  depAirport: string | null;
  arrAirport: string | null;
  scheduledDep: string | null;
}

interface Trip {
  id: number;
  title: string;
  startDate: string | null;
}

export function AddToTripSheet({
  visible,
  flight,
  onClose,
}: {
  visible: boolean;
  flight: FlightForTrip | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const qc = useQueryClient();
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data } = useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: () => customFetch<Trip[]>("/api/trips", { responseType: "json" }),
    enabled: visible,
    retry: false,
  });
  const trips = Array.isArray(data) ? data : [];

  function itemBody() {
    if (!flight) return null;
    return {
      type: "flight",
      title: `${flight.flightNumber} ${flight.depAirport ?? ""}→${flight.arrAirport ?? ""}`.trim(),
      startAt: flight.scheduledDep ?? undefined,
      location: flight.depAirport ?? undefined,
    };
  }

  const addToExisting = useMutation({
    mutationFn: (tripId: number) =>
      customFetch(`/api/trips/${tripId}/items`, { method: "POST", body: JSON.stringify(itemBody()) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["trips"] });
      setDone("Added to your trip.");
    },
  });

  async function createAndAdd() {
    if (!flight) return;
    setBusy(true);
    try {
      const title = `${flight.depAirport ?? "Trip"} → ${flight.arrAirport ?? ""}`.trim();
      const trip = await customFetch<{ id: number }>("/api/trips", {
        method: "POST",
        body: JSON.stringify({
          title,
          destination: flight.arrAirport ?? undefined,
          startDate: flight.scheduledDep ? flight.scheduledDep.slice(0, 10) : undefined,
        }),
      });
      await customFetch(`/api/trips/${trip.id}/items`, { method: "POST", body: JSON.stringify(itemBody()) });
      void qc.invalidateQueries({ queryKey: ["trips"] });
      setDone("New trip created.");
    } catch {
      setDone("Couldn't save that — please try again.");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setDone(null);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {done ? "Done" : `Add ${flight?.flightNumber ?? "flight"} to a trip`}
            </Text>
            <Pressable onPress={close} hitSlop={10}>
              <Icon name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {done ? (
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={[styles.doneText, { color: colors.mutedForeground }]}>{done}</Text>
              <Pressable
                onPress={() => {
                  close();
                  router.push("/trips");
                }}
                style={[styles.cta, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>View trips</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable
                onPress={createAndAdd}
                disabled={busy}
                style={[styles.newBtn, { borderColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={[styles.newBtnText, { color: colors.primary }]}>＋ New trip from this flight</Text>
                )}
              </Pressable>

              {trips.length > 0 && (
                <>
                  <Text style={[styles.orLabel, { color: colors.mutedForeground }]}>OR ADD TO</Text>
                  <ScrollView style={{ maxHeight: 260 }}>
                    {trips.map((t) => (
                      <Pressable
                        key={t.id}
                        disabled={addToExisting.isPending}
                        onPress={() => addToExisting.mutate(t.id)}
                        style={({ pressed }) => [styles.tripRow, { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
                      >
                        <Text style={[styles.tripTitle, { color: colors.foreground }]}>{t.title}</Text>
                        <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    ))}
                  </ScrollView>
                </>
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontFamily: "Inter_700Bold", fontSize: 17, flex: 1 },
  newBtn: { height: 50, borderWidth: 1.5, borderRadius: 12, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  newBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  orLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8, marginTop: 18, marginBottom: 6 },
  tripRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1 },
  tripTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  doneText: { fontFamily: "Inter_400Regular", fontSize: 15, marginBottom: 18 },
  cta: { alignSelf: "stretch", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
