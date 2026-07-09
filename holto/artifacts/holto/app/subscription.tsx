import { Icon } from "@/components/Icon";
import * as Linking from "expo-linking";
import { router, Stack } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { customFetch } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSubscription, useStripeProducts, type StripeProduct } from "@/hooks/useSubscription";
import { TIER_DISPLAY, PRODUCT_IDS, type Tier } from "@/constants/tiers";

function formatPrice(unitAmount: number, currency: string): string {
  const amount = unitAmount / 100;
  const symbol = currency.toLowerCase() === "gbp" ? "£" : currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${symbol}${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function intervalLabel(interval: string | null, intervalCount: number | null): string {
  if (!interval) return "one-time";
  const count = intervalCount ?? 1;
  if (interval === "day" && count === 7) return "/ 7 days";
  if (interval === "month" && count === 1) return "/ month";
  if (interval === "year" && count === 1) return "/ year";
  return `/ ${count} ${interval}${count > 1 ? "s" : ""}`;
}

type PlanCard = {
  productId: string;
  priceId: string;
  tier: Tier;
  name: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
};

function buildPlans(products: StripeProduct[]): PlanCard[] {
  const plans: PlanCard[] = [];

  for (const product of products) {
    for (const price of product.prices) {
      plans.push({
        productId: product.id,
        priceId: price.id,
        tier: (product.tier as Tier) ?? "free",
        name: product.name,
        unitAmount: price.unitAmount,
        currency: price.currency,
        interval: price.interval,
        intervalCount: price.intervalCount,
      });
    }
  }

  plans.sort((a, b) => {
    const tierOrder: Record<Tier, number> = { free: 0, trip_pass: 1, pro: 2 };
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDiff !== 0) return tierDiff;
    return a.unitAmount - b.unitAmount;
  });

  return plans;
}

export default function SubscriptionScreen() {
  const colors = useColors();
  const { token } = useAuth();
  const { tier: currentTier, refresh } = useSubscription();
  const { data: productsData, isLoading: productsLoading } = useStripeProducts();
  const [loading, setLoading] = useState<string | null>(null);

  const plans = buildPlans(productsData?.products ?? []);

  const handleCheckout = async (priceId: string) => {
    if (!token) {
      Alert.alert("Sign in required", "Please sign in to upgrade your plan.");
      router.push("/login" as never);
      return;
    }
    setLoading(priceId);
    try {
      const data = await customFetch<{ url?: string; error?: string }>("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (!data.url) throw new Error(data.error ?? "Failed to create checkout");
      await Linking.openURL(data.url);
      refresh();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } }).data;
      Alert.alert("Error", body?.error ?? (err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!token) return;
    setLoading("portal");
    try {
      const data = await customFetch<{ url?: string; error?: string }>("/api/stripe/portal", {
        method: "POST",
      });
      if (!data.url) throw new Error(data.error ?? "Failed");
      await Linking.openURL(data.url);
      refresh();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } }).data;
      Alert.alert("Error", body?.error ?? (err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(null);
    }
  };

  const tierDisplay = TIER_DISPLAY[currentTier];

  return (
    <>
      <Stack.Screen
        options={{
          title: "HOLTO Plans",
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "Inter_700Bold" },
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            Choose your plan
          </Text>
          <Text style={[styles.subheadline, { color: colors.mutedForeground }]}>
            From one trip to full expat life — HOLTO grows with you.
          </Text>
        </View>

        <View style={[styles.currentBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon name="check-circle" size={16} color={colors.primary} />
          <Text style={[styles.currentBadgeText, { color: colors.foreground }]}>
            Current plan:{" "}
            <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>
              {tierDisplay.label}
            </Text>
          </Text>
          {currentTier !== "free" && (
            <Pressable onPress={handlePortal} disabled={loading === "portal"}>
              <Text style={[styles.manageLink, { color: colors.primary }]}>
                {loading === "portal" ? "…" : "Manage"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Free tier */}
        <View
          style={[
            styles.planCard,
            { backgroundColor: colors.card, borderColor: currentTier === "free" ? colors.primary : colors.border },
          ]}
        >
          <View style={styles.planHeader}>
            <View>
              <Text style={[styles.planName, { color: colors.foreground }]}>Free</Text>
              <Text style={[styles.planPrice, { color: colors.foreground }]}>
                £0{" "}
                <Text style={[styles.planInterval, { color: colors.mutedForeground }]}>
                  forever
                </Text>
              </Text>
            </View>
            <View style={[styles.tierBadge, { backgroundColor: TIER_DISPLAY.free.badgeColor + "22" }]}>
              <Text style={[styles.tierBadgeText, { color: TIER_DISPLAY.free.badgeColor }]}>
                {TIER_DISPLAY.free.badge}
              </Text>
            </View>
          </View>
          <FeatureList features={TIER_DISPLAY.free.features} locked={TIER_DISPLAY.free.lockedFeatures} colors={colors} />
          {currentTier === "free" && (
            <View style={[styles.currentPill, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.currentPillText, { color: colors.primary }]}>Your current plan</Text>
            </View>
          )}
        </View>

        {productsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading plans…</Text>
          </View>
        ) : plans.length === 0 ? (
          <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.planName, { color: colors.mutedForeground, textAlign: "center" }]}>
              Plan details loading soon
            </Text>
          </View>
        ) : (
          plans.map((plan) => {
            const display = TIER_DISPLAY[plan.tier];
            const isCurrentTier = currentTier === plan.tier;
            const isLoadingThis = loading === plan.priceId;
            const label = `${formatPrice(plan.unitAmount, plan.currency)} ${intervalLabel(plan.interval, plan.intervalCount)}`;

            return (
              <View
                key={plan.priceId}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isCurrentTier ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={styles.planHeader}>
                  <View>
                    <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                    <Text style={[styles.planPrice, { color: colors.foreground }]}>
                      {formatPrice(plan.unitAmount, plan.currency)}{" "}
                      <Text style={[styles.planInterval, { color: colors.mutedForeground }]}>
                        {intervalLabel(plan.interval, plan.intervalCount)}
                      </Text>
                    </Text>
                  </View>
                  <View style={[styles.tierBadge, { backgroundColor: display.badgeColor + "22" }]}>
                    <Text style={[styles.tierBadgeText, { color: display.badgeColor }]}>
                      {display.badge}
                    </Text>
                  </View>
                </View>

                <FeatureList features={display.features} locked={[]} colors={colors} />

                {isCurrentTier ? (
                  <View style={[styles.currentPill, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.currentPillText, { color: colors.primary }]}>Your current plan</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      styles.upgradeBtn,
                      { backgroundColor: display.badgeColor, opacity: pressed || isLoadingThis ? 0.8 : 1 },
                    ]}
                    onPress={() => handleCheckout(plan.priceId)}
                    disabled={!!loading}
                  >
                    {isLoadingThis ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.upgradeBtnText}>{label}</Text>
                        <Icon name="arrow-right" size={16} color="#fff" />
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            );
          })
        )}

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Payments processed securely by Stripe. Cancel anytime from your account.
        </Text>
      </ScrollView>
    </>
  );
}

function FeatureList({
  features,
  locked,
  colors,
}: {
  features: string[];
  locked: string[];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.featureList}>
      {features.map((f) => (
        <View key={f} style={styles.featureRow}>
          <Icon name="check" size={14} color={colors.primary} />
          <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
        </View>
      ))}
      {locked.map((f) => (
        <View key={f} style={styles.featureRow}>
          <Icon name="lock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48, gap: 16 },
  header: { paddingTop: 8, gap: 8 },
  headline: { fontSize: 28, fontFamily: "Inter_700Bold" },
  subheadline: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  currentBadgeText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  manageLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  planCard: { borderRadius: 16, borderWidth: 1.5, padding: 20, gap: 16 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planName: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  planPrice: { fontSize: 22, fontFamily: "Inter_700Bold" },
  planInterval: { fontSize: 14, fontFamily: "Inter_400Regular" },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tierBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  featureList: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  currentPill: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  currentPillText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  upgradeBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "center", padding: 20 },
  loadingText: { fontSize: 14 },
  footer: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, marginTop: 8 },
});
