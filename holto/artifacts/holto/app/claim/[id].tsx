import { Icon } from "@/components/Icon";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RetryError } from "@/components/RetryError";
import { useColors } from "@/hooks/useColors";
import { useClaim, useUpdateClaim, type ClaimStatus } from "@/hooks/useClaims";

const STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  airline_responded: "Airline responded",
  paid: "Paid",
  rejected: "Rejected",
  escalated: "Escalated",
  closed: "Closed",
};

// Forward actions offered per status (mirrors the server state machine).
const NEXT_ACTIONS: Record<ClaimStatus, ClaimStatus[]> = {
  draft: ["submitted"],
  submitted: ["airline_responded", "paid", "rejected"],
  airline_responded: ["paid", "rejected", "escalated"],
  rejected: ["escalated", "closed"],
  escalated: ["paid", "rejected"],
  paid: ["closed"],
  closed: [],
};

const ACTION_LABEL: Record<ClaimStatus, string> = {
  draft: "Back to draft",
  submitted: "Mark as submitted",
  airline_responded: "Airline responded",
  paid: "Mark as paid",
  rejected: "Mark as rejected",
  escalated: "Escalate to regulator",
  closed: "Close this claim",
};

const STEPS: { key: ClaimStatus; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "airline_responded", label: "Responded" },
  { key: "paid", label: "Resolved" },
];

function stepIndexFor(status: ClaimStatus): number {
  switch (status) {
    case "draft":
      return 0;
    case "submitted":
      return 1;
    case "airline_responded":
    case "escalated":
      return 2;
    case "paid":
    case "rejected":
    case "closed":
      return 3;
  }
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function ClaimScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const claimId = id ? parseInt(id, 10) : NaN;

  const { data: claim, isLoading, error, refetch } = useClaim(claimId);
  const { mutateAsync: updateClaim, isPending } = useUpdateClaim(claimId);
  const [copied, setCopied] = useState(false);

  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (error || !claim) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <RetryError message="Couldn't load this claim. Check your connection and try again." onRetry={() => refetch()} />
      </View>
    );
  }

  const status = claim.status;
  const currentStep = stepIndexFor(status);
  const isBad = status === "rejected" || status === "escalated";

  const advance = async (to: ClaimStatus) => {
    try {
      await updateClaim({ status: to });
    } catch {
      // surfaced via query error state on next render; keep UI responsive
    }
  };

  const copyLetter = async () => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined" && window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(claim.letter);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } else {
        await Share.share({ message: claim.letter, title: "EU261 compensation claim" });
      }
    } catch {
      /* silent */
    }
  };

  const statusColor =
    status === "paid"
      ? "#2E7D52"
      : isBad
        ? colors.destructive
        : status === "closed"
          ? colors.mutedForeground
          : colors.primary;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.flight, { color: colors.foreground }]}>
            {claim.airline} {claim.flightNumber}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Compensation claim</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "1A", borderColor: statusColor + "40" }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>

      {/* Amount */}
      <View style={[styles.amountCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30", borderRadius: colors.radius }]}>
        <Text style={[styles.amountLabel, { color: colors.primary }]}>
          {status === "paid" ? "Amount received" : "Claiming"}
        </Text>
        <Text style={[styles.amount, { color: colors.primary }]}>
          {status === "paid" && claim.amountReceived != null
            ? `€${claim.amountReceived}`
            : claim.amount != null
              ? `€${claim.amount}`
              : "Amount per EU261/UK261"}
        </Text>
        {claim.referenceNumber ? (
          <Text style={[styles.ref, { color: colors.mutedForeground }]}>Ref: {claim.referenceNumber}</Text>
        ) : null}
      </View>

      {/* Progress stepper */}
      <View style={styles.stepper}>
        {STEPS.map((step, i) => {
          const reached = i <= currentStep;
          const dotColor = isBad && i === 3 ? colors.destructive : reached ? colors.primary : colors.border;
          const label = i === 3 && isBad ? STATUS_LABEL[status] : step.label;
          return (
            <View key={step.key} style={styles.step}>
              <View style={styles.stepLine}>
                {i > 0 ? (
                  <View style={[styles.line, { backgroundColor: i <= currentStep ? colors.primary : colors.border }]} />
                ) : (
                  <View style={styles.line} />
                )}
                <View style={[styles.dot, { backgroundColor: dotColor }]}>
                  {reached ? <Icon name={isBad && i === 3 ? "alert-circle" : "check"} size={11} color="#fff" /> : null}
                </View>
                {i < STEPS.length - 1 ? (
                  <View style={[styles.line, { backgroundColor: i < currentStep ? colors.primary : colors.border }]} />
                ) : (
                  <View style={styles.line} />
                )}
              </View>
              <Text style={[styles.stepLabel, { color: reached ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Next actions */}
      {NEXT_ACTIONS[status].length > 0 && (
        <View style={styles.actions}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Update your claim</Text>
          {NEXT_ACTIONS[status].map((to) => {
            const primary = to === "paid" || to === "submitted";
            const danger = to === "rejected";
            return (
              <Pressable
                key={to}
                disabled={isPending}
                onPress={() => advance(to)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  {
                    backgroundColor: primary ? colors.primary : colors.card,
                    borderColor: danger ? colors.destructive + "60" : primary ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed || isPending ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: primary ? "#fff" : danger ? colors.destructive : colors.foreground },
                  ]}
                >
                  {ACTION_LABEL[to]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Letter */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your claim letter</Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Fill in the bracketed fields, then send it to the airline's official EU261 / customer-relations channel. Keep proof of sending.
        </Text>
        <View style={[styles.letterCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.letterText, { color: colors.foreground }]} selectable>
            {claim.letter}
          </Text>
        </View>
        <Pressable
          onPress={copyLetter}
          style={({ pressed }) => [
            styles.letterAction,
            { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name={copied ? "check" : "share-2"} size={16} color="#fff" />
          <Text style={styles.letterActionText}>{copied ? "Copied!" : "Copy / share letter"}</Text>
        </Pressable>
      </View>

      {/* Timeline */}
      {claim.timeline.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>History</Text>
          <View style={[styles.letterCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, padding: 14 }]}>
            {claim.timeline.map((entry, i) => (
              <View key={i} style={styles.timelineRow}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.timelineText, { color: colors.foreground }]}>
                  {STATUS_LABEL[entry.status]}
                  <Text style={{ color: colors.mutedForeground }}> · {formatWhen(entry.at)}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Escalation */}
      <View style={[styles.escalation, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
        <View style={styles.sectionHeaderRow}>
          <Icon name="shield" size={15} color={colors.teal} />
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>If the airline refuses or ignores you</Text>
        </View>
        <Text style={[styles.escalationText, { color: colors.mutedForeground }]}>
          After 8 weeks with no fair resolution you can escalate for free: the UK Civil Aviation Authority (PACT) or an approved ADR body for UK/EU airlines, or the National Enforcement Body of the country you departed from in the EU. You can also use the small-claims court. This is guidance only, not legal advice.
        </Text>
      </View>

      <Pressable onPress={() => router.back()} style={styles.backLink}>
        <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>← Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  flight: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  statusBadge: { borderWidth: 1, borderRadius: 40, paddingHorizontal: 12, paddingVertical: 5 },
  statusBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  amountCard: { borderWidth: 1, padding: 18, marginBottom: 18 },
  amountLabel: { fontFamily: "Inter_500Medium", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 },
  amount: { fontFamily: "Inter_700Bold", fontSize: 36, letterSpacing: -1, marginTop: 4 },
  ref: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 },
  stepper: { flexDirection: "row", marginBottom: 22 },
  step: { flex: 1, alignItems: "center" },
  stepLine: { flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "center" },
  line: { flex: 1, height: 2 },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 6 },
  actions: { marginBottom: 22, gap: 10 },
  section: { marginBottom: 22 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, marginBottom: 8 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginBottom: 10 },
  actionBtn: { height: 50, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  letterCard: { borderWidth: 1, padding: 16 },
  letterText: { fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace", fontSize: 12, lineHeight: 20 },
  letterAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, marginTop: 10 },
  letterActionText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  timelineDot: { width: 8, height: 8, borderRadius: 4 },
  timelineText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  escalation: { padding: 16, marginBottom: 20 },
  escalationText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20, marginTop: 8 },
  backLink: { alignItems: "center", paddingVertical: 8 },
  backLinkText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
