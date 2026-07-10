import { Icon } from "@/components/Icon";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDisruptionQueryKey,
  getListDisruptionsQueryKey,
  useGetDisruption,
  useSubscribeStarterPack,
  useUpdateDisruption,
} from "@workspace/api-client-react";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BeyondSection } from "@/components/BeyondSection";
import { ChecklistItemRow } from "@/components/ChecklistItemRow";
import { CompanionBanner } from "@/components/CompanionBanner";
import ComplaintLetterModal from "@/components/ComplaintLetterModal";
import { ProactiveActionCard } from "@/components/ProactiveActionCard";
import { RetryError } from "@/components/RetryError";
import { StarterPackCard } from "@/components/StarterPackCard";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useCreateClaim } from "@/hooks/useClaims";
import { calcEU261, getAirportDistance, type DisruptionKind } from "@/utils/eu261";

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  category?: string;
}

interface ActionItem {
  order: number;
  title: string;
  description: string;
}

interface ProactiveActionShape {
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  why: string;
}

const TYPE_LABELS: Record<string, string> = {
  delay: "Delayed",
  cancellation: "Cancelled",
  missed_connection: "Missed Connection",
  denied_boarding: "Denied Boarding",
};

export default function DisruptionResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const disruptionId = id ? parseInt(id, 10) : NaN;
  const isValidId = !isNaN(disruptionId) && disruptionId > 0;

  const {
    data: disruption,
    isLoading,
    error,
    refetch,
  } = useGetDisruption(isValidId ? disruptionId : 0, {
    query: {
      queryKey: getGetDisruptionQueryKey(isValidId ? disruptionId : 0),
      enabled: isValidId,
    },
  });

  const { mutateAsync: updateDisruption } = useUpdateDisruption();
  const { mutateAsync: subscribeStarterPack } = useSubscribeStarterPack();
  const { mutateAsync: createClaim, isPending: claimPending } = useCreateClaim();

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [letterVisible, setLetterVisible] = useState(false);

  const startClaim = async () => {
    try {
      const claim = await createClaim(disruptionId);
      router.push(`/claim/${claim.id}`);
    } catch {
      // stay on page; the button remains available to retry
    }
  };

  useEffect(() => {
    if (disruption?.checklist) {
      setChecklist(disruption.checklist as ChecklistItem[]);
    }
  }, [disruption?.checklist]);

  const toggleItem = async (itemId: string) => {
    const updated = checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    );
    setChecklist(updated);
    try {
      await updateDisruption({ id: disruptionId, data: { checklist: updated } });
      qc.invalidateQueries({ queryKey: getGetDisruptionQueryKey(disruptionId) });
      qc.invalidateQueries({ queryKey: getListDisruptionsQueryKey() });
    } catch {
      setChecklist(checklist);
    }
  };

  const handleShare = async () => {
    if (!disruption) return;
    const actions = (disruption.actions as ActionItem[] | null) ?? [];
    const msg = [
      `HOLTO Disruption Summary`,
      `Flight: ${disruption.airline} ${disruption.flightNumber}`,
      `Route: ${disruption.origin} → ${disruption.destination}`,
      `Issue: ${TYPE_LABELS[disruption.disruptionType] ?? disruption.disruptionType}`,
      ``,
      `YOUR RIGHTS:`,
      disruption.rights ?? "See app for full details",
      ``,
      `NEXT STEPS:`,
      ...actions.map((a, i) => `${i + 1}. ${a.title}: ${a.description}`),
    ].join("\n");
    try {
      await Share.share({ message: msg, title: "HOLTO Flight Summary" });
    } catch {
    }
  };

  if (!isValidId) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <RetryError message="Something went wrong with this page." onRetry={() => router.back()} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.root,
          styles.loadingWrap,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
          Analysing your situation
        </Text>
        <Text style={[styles.loadingSubtitle, { color: colors.mutedForeground }]}>
          Checking your rights under UK/EU261…
        </Text>
      </View>
    );
  }

  if (error || !disruption) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <RetryError
          message="Couldn't load this disruption. Check your connection and try again."
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  const actions = (disruption.actions as ActionItem[] | null) ?? [];
  const proactiveAction = disruption.proactiveAction as ProactiveActionShape | null;
  const doneCount = checklist.filter((i) => i.done).length;
  const totalCount = checklist.length;
  const isHandled = totalCount > 0 && doneCount === totalCount;

  const alreadySubscribed = !!user?.starterPackEmail;

  const distKm = getAirportDistance(disruption.origin ?? "", disruption.destination ?? "");
  const compensationResult = distKm !== null
    ? calcEU261(distKm, (disruption.disruptionType ?? "delay") as DisruptionKind, 3)
    : null;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        { paddingBottom: bottomPad + 40 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={styles.flightMeta}>
        <View style={styles.flightRow}>
          <View>
            <Text style={[styles.flightCode, { color: colors.foreground }]}>
              {disruption.airline || "–"} {disruption.flightNumber || "–"}
            </Text>
            <View style={styles.routeRow}>
              <Text style={[styles.airport, { color: colors.mutedForeground }]}>
                {disruption.origin || "–"}
              </Text>
              <Icon
                name="arrow-right"
                size={12}
                color={colors.mutedForeground}
                style={styles.arrow}
              />
              <Text style={[styles.airport, { color: colors.mutedForeground }]}>
                {disruption.destination || "–"}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: colors.muted,
                borderRadius: colors.radius / 2,
              },
            ]}
          >
            <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
              {TYPE_LABELS[disruption.disruptionType] ?? disruption.disruptionType}
            </Text>
          </View>
        </View>
      </Animated.View>

      {!!disruption.companionMessage && (
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <CompanionBanner
            message={disruption.companionMessage}
            proactiveHint={disruption.proactiveHint}
          />
        </Animated.View>
      )}

      {!disruption.companionMessage && (
        <Animated.View
          entering={FadeInDown.delay(100).duration(500)}
          style={[
            styles.fallbackBanner,
            { backgroundColor: colors.muted, borderRadius: colors.radius },
          ]}
        >
          <Icon name="shield" size={16} color={colors.teal} />
          <Text style={[styles.fallbackText, { color: colors.foreground }]}>
            Your disruption has been saved. We're working on your rights analysis — please check back shortly.
          </Text>
        </Animated.View>
      )}

      {!!proactiveAction && (
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <ProactiveActionCard action={proactiveAction} />
        </Animated.View>
      )}

      {!!disruption.rights && (
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="book-open" size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Your likely rights
            </Text>
          </View>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text style={[styles.rightsText, { color: colors.foreground }]}>
              {disruption.rights}
            </Text>
            <View
              style={[
                styles.disclaimer,
                {
                  backgroundColor: colors.muted,
                  borderRadius: colors.radius / 2,
                },
              ]}
            >
              <Icon name="info" size={11} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.disclaimerText,
                  { color: colors.mutedForeground },
                ]}
              >
                Guidance only — not legal advice. Verify with your airline or the CAA/NEB.
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {compensationResult && (
        <Animated.View entering={FadeInDown.delay(320).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="dollar-sign" size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Potential EU261 compensation
            </Text>
          </View>
          <View
            style={[
              styles.compCard,
              {
                backgroundColor: compensationResult.eligible ? colors.primary + "12" : colors.card,
                borderColor: compensationResult.eligible ? colors.primary + "35" : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            {compensationResult.eligible ? (
              <>
                <View style={styles.compRow}>
                  <View>
                    <Text style={[styles.compLabel, { color: colors.primary }]}>You may be owed</Text>
                    <Text style={[styles.compAmount, { color: colors.primary }]}>
                      €{compensationResult.amount}
                    </Text>
                    <Text style={[styles.compTier, { color: colors.mutedForeground }]}>
                      {compensationResult.tier} · {compensationResult.distKm.toLocaleString()} km
                    </Text>
                  </View>
                  <View style={[styles.compBadge, { backgroundColor: colors.primary }]}>
                    <Icon name="check" size={20} color="#fff" />
                  </View>
                </View>
                {compensationResult.note ? (
                  <View style={[styles.compNote, { borderTopColor: colors.border }]}>
                    <Text style={[styles.compNoteText, { color: colors.mutedForeground }]}>
                      ⓘ {compensationResult.note}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.compIneligible}>
                <Icon name="info" size={16} color={colors.mutedForeground} />
                <Text style={[styles.compIneligibleText, { color: colors.foreground }]}>
                  {compensationResult.reason}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {actions.length > 0 && (
        <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="zap" size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              What to do
            </Text>
          </View>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            {actions.map((action, i) => (
              <View
                key={action.order ?? i}
                style={[
                  styles.actionRow,
                  i < actions.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.actionNum,
                    { backgroundColor: colors.primary, borderRadius: 12 },
                  ]}
                >
                  <Text style={styles.actionNumText}>{action.order ?? i + 1}</Text>
                </View>
                <View style={styles.actionContent}>
                  <Text
                    style={[styles.actionTitle, { color: colors.foreground }]}
                  >
                    {action.title || ""}
                  </Text>
                  <Text
                    style={[
                      styles.actionDesc,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {action.description || ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {checklist.length > 0 && (
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="check-square" size={15} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Your checklist
            </Text>
            <Text style={[styles.checkCount, { color: colors.mutedForeground }]}>
              {doneCount}/{totalCount} done
            </Text>
          </View>
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                paddingHorizontal: 16,
                paddingVertical: 4,
              },
            ]}
          >
            {checklist.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                onToggle={toggleItem}
              />
            ))}
          </View>
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(450).duration(500)} style={{ gap: 10 }}>
        <Pressable
          disabled={claimPending}
          style={({ pressed }) => [
            styles.shareBtn,
            styles.letterBtn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed || claimPending ? 0.85 : 1,
            },
          ]}
          onPress={startClaim}
        >
          {claimPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Icon name="briefcase" size={15} color="#fff" />
          )}
          <Text style={styles.letterBtnText}>
            {claimPending ? "Preparing your claim…" : "Start your compensation claim"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.shareBtn,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => setLetterVisible(true)}
        >
          <Icon name="file-text" size={15} color={colors.primary} />
          <Text style={[styles.shareBtnText, { color: colors.primary }]}>
            Quick complaint letter
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.shareBtn,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={handleShare}
        >
          <Icon name="share-2" size={15} color={colors.primary} />
          <Text style={[styles.shareBtnText, { color: colors.primary }]}>
            Share summary
          </Text>
        </Pressable>
      </Animated.View>

      <ComplaintLetterModal
        visible={letterVisible}
        onClose={() => setLetterVisible(false)}
        disruption={disruption}
        compensationAmount={compensationResult?.eligible ? compensationResult.amount : null}
      />

      <Animated.View
        entering={FadeInDown.delay(500).duration(500)}
        style={styles.section}
      >
        <StarterPackCard
          defaultEmail={user?.email ?? ""}
          alreadySubscribed={alreadySubscribed}
          onSubscribe={async (email) => {
            await subscribeStarterPack({ data: { email } });
          }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(550).duration(500)}>
        <BeyondSection />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    textAlign: "center",
  },
  loadingSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  flightMeta: { marginBottom: 20 },
  flightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  flightCode: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  routeRow: { flexDirection: "row", alignItems: "center" },
  airport: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  arrow: { marginHorizontal: 6 },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  typeBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  fallbackBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    marginBottom: 20,
  },
  fallbackText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    flex: 1,
  },
  checkCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    overflow: "hidden",
  },
  rightsText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    margin: 10,
    padding: 10,
  },
  disclaimerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
  },
  actionNum: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  actionNumText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#fff",
  },
  actionContent: { flex: 1 },
  actionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    marginBottom: 3,
  },
  actionDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderWidth: 1,
    marginBottom: 0,
  },
  shareBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  letterBtn: {},
  letterBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  compCard: {
    borderWidth: 1,
    padding: 16,
    overflow: "hidden",
  },
  compRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  compLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  compAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    letterSpacing: -1,
  },
  compTier: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  compBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  compNote: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  compNoteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  compIneligible: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  compIneligibleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
});
