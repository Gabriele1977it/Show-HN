import { Icon } from "@/components/Icon";
import {
  customFetch,
  getListDisruptionsQueryKey,
  useListDisruptions,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DisruptionCard } from "@/components/DisruptionCard";
import { RetryError } from "@/components/RetryError";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useClaims, type ClaimStatus } from "@/hooks/useClaims";

const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  airline_responded: "Airline responded",
  paid: "Paid",
  rejected: "Rejected",
  escalated: "Escalated",
  closed: "Closed",
};

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const { data: claims } = useClaims();

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
      try {
        // customFetch applies the API base URL + auth; a raw relative fetch
        // would hit the web host, not the API, and silently fail.
        await customFetch(`/api/disruptions/${id}`, { method: "DELETE" });
        await refetch();
      } catch {
        // silently ignore — user can retry
      }
    },
    [token, refetch],
  );

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: topPad + 16, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>
          History
        </Text>
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          Your reported disruptions and compensation claims
        </Text>
      </Animated.View>

      {claims && claims.length > 0 && (
        <Animated.View entering={FadeInDown.delay(60).duration(500)} style={styles.claimsSection}>
          <Text style={[styles.claimsHeading, { color: colors.foreground }]}>Your claims</Text>
          {claims.map((c) => {
            const sc =
              c.status === "paid"
                ? "#2E7D52"
                : c.status === "rejected" || c.status === "escalated"
                  ? colors.destructive
                  : c.status === "closed"
                    ? colors.mutedForeground
                    : colors.primary;
            return (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/claim/${c.id}`)}
                style={({ pressed }) => [
                  styles.claimRow,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.claimFlight, { color: colors.foreground }]}>
                    {c.airline} {c.flightNumber}
                  </Text>
                  <Text style={[styles.claimMeta, { color: colors.mutedForeground }]}>
                    {c.amount != null ? `Claiming €${c.amount}` : "EU261 / UK261 claim"}
                  </Text>
                </View>
                <View style={[styles.claimBadge, { backgroundColor: sc + "1A" }]}>
                  <Text style={[styles.claimBadgeText, { color: sc }]}>{CLAIM_STATUS_LABEL[c.status]}</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </Animated.View>
      )}

      {isLoading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading your records…
          </Text>
        </View>
      )}

      {isError && !isLoading && (
        <RetryError
          message="Couldn't load your history. Check your connection and try again."
          onRetry={refetch}
        />
      )}

      {!isLoading && !isError && disruptions?.length === 0 && (
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={[
            styles.emptyWrap,
            { borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.muted, borderRadius: 24 },
            ]}
          >
            <Icon name="clock" size={26} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nothing here yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Your disruption records will appear here after you report a flight problem.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.emptyBtn,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => router.push("/disruption/wizard")}
          >
            <Text style={styles.emptyBtnText}>Report a problem</Text>
          </Pressable>
        </Animated.View>
      )}

      {!isLoading && !isError && disruptions && disruptions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Text style={[styles.countNote, { color: colors.mutedForeground }]}>
            {disruptions.length} disruption{disruptions.length !== 1 ? "s" : ""} on record
          </Text>
          {disruptions.map((d) => (
            <DisruptionCard key={d.id} disruption={d} onDelete={handleDelete} />
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  pageHeader: { marginBottom: 24 },
  pageTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 27,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  countNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 12,
  },
  claimsSection: { marginBottom: 24 },
  claimsHeading: { fontFamily: "Inter_600SemiBold", fontSize: 16, marginBottom: 10 },
  claimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  claimFlight: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  claimMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  claimBadge: { borderRadius: 40, paddingHorizontal: 10, paddingVertical: 4 },
  claimBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  emptyWrap: {
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 32,
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 6,
  },
  emptyBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
});
