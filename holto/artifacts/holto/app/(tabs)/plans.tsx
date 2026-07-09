import { Icon } from "@/components/Icon";
import { customFetch } from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSubscription, useStripeProducts, type StripeProduct } from "@/hooks/useSubscription";
import { TIER_DISPLAY, type Tier } from "@/constants/tiers";

// ─── Fallback prices (shown while API loads or if products unavailable) ───────

const FALLBACK_PRICES: Record<Tier, { amount: string; interval: string }> = {
  free:       { amount: "£0",     interval: "forever" },
  trip_pass:  { amount: "£3.49",  interval: "one-time" },
  pro:        { amount: "£6.99",  interval: "month" },
};

const FALLBACK_PRO_ANNUAL = { amount: "£59.99", interval: "year" };

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatPrice(unitAmount: number, currency: string): string {
  const amount = unitAmount / 100;
  const symbol =
    currency.toLowerCase() === "gbp"
      ? "£"
      : currency.toLowerCase() === "usd"
        ? "$"
        : currency.toUpperCase() + " ";
  return `${symbol}${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function intervalLabel(interval: string | null, intervalCount: number | null): string {
  if (!interval) return "one-time";
  const count = intervalCount ?? 1;
  if (interval === "day" && count === 7) return "7 days";
  if (interval === "month" && count === 1) return "month";
  if (interval === "year" && count === 1) return "year";
  return `${count} ${interval}${count > 1 ? "s" : ""}`;
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
    const order: Record<Tier, number> = { free: 0, trip_pass: 1, pro: 2 };
    const d = order[a.tier] - order[b.tier];
    return d !== 0 ? d : a.unitAmount - b.unitAmount;
  });
  return plans;
}

const TIER_ORDER: Record<Tier, number> = { free: 0, trip_pass: 1, pro: 2 };

const PLAN_CONFIG: Record<Tier, { gradients: [string, string]; icon: string }> = {
  free: { gradients: ["#2D4A55", "#0A2E38"], icon: "gift" },
  trip_pass: { gradients: ["#1C7C8C", "#0e5566"], icon: "zap" },
  pro: { gradients: ["#7c3aed", "#5b21b6"], icon: "star" },
};

// ─── Feature row ─────────────────────────────────────────────────────────────

function FeatureItem({
  text,
  locked,
  dark,
}: {
  text: string;
  locked?: boolean;
  dark?: boolean;
}) {
  return (
    <View style={styles.featureItem}>
      <Icon
        name={locked ? "lock" : "check"}
        size={13}
        color={locked ? "rgba(255,255,255,0.35)" : dark ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.85)"}
      />
      <Text
        style={[
          styles.featureItemText,
          locked && { opacity: 0.45 },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

// ─── Plan card ───────────────────────────────────────────────────────────────

function PlanTierCard({
  tier,
  plan,
  isCurrentTier,
  isBestValue,
  isLoadingThis,
  onCheckout,
  onManage,
  isLoggedIn,
  index,
}: {
  tier: Tier;
  plan: PlanCard | null;
  isCurrentTier: boolean;
  isBestValue?: boolean;
  isLoadingThis?: boolean;
  onCheckout: (priceId: string) => void;
  onManage: () => void;
  isLoggedIn: boolean;
  index: number;
}) {
  const display = TIER_DISPLAY[tier];
  const config = PLAN_CONFIG[tier];
  const isFree = tier === "free";

  const fallback = FALLBACK_PRICES[tier];

  const priceLabel = isFree
    ? "£0"
    : plan
      ? formatPrice(plan.unitAmount, plan.currency)
      : fallback.amount;

  const intervalStr = isFree
    ? "forever"
    : plan
      ? intervalLabel(plan.interval, plan.intervalCount)
      : fallback.interval;

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100).springify().damping(16)}
      style={[styles.planCard, isBestValue && styles.planCardFeatured]}
    >
      {isBestValue && (
        <View style={styles.bestValueTag}>
          <Icon name="award" size={11} color="#fff" />
          <Text style={styles.bestValueText}>BEST VALUE</Text>
        </View>
      )}

      <LinearGradient
        colors={config.gradients}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Icon name={config.icon} size={18} color="rgba(255,255,255,0.9)" />
          </View>
          <View style={[styles.tierPill]}>
            <Text style={styles.tierPillText}>{display.badge}</Text>
          </View>
        </View>

        <Text style={styles.cardName}>{display.label}</Text>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.priceAmount}>{priceLabel}</Text>
          {intervalStr ? (
            <Text style={styles.priceInterval}>
              {" / "}{intervalStr}
            </Text>
          ) : null}
        </View>

        {/* Features */}
        <View style={styles.featureList}>
          {display.features.map((f) => (
            <FeatureItem key={f} text={f} dark />
          ))}
          {display.lockedFeatures.map((f) => (
            <FeatureItem key={f} text={f} locked dark />
          ))}
        </View>
      </LinearGradient>

      {/* CTA footer */}
      <View style={styles.cardFooter}>
        {isCurrentTier ? (
          <View style={styles.currentRow}>
            <Icon name="check-circle" size={15} color="#1C7C8C" />
            <Text style={styles.currentLabel}>Your current plan</Text>
            {!isFree && (
              <Pressable onPress={onManage} hitSlop={8}>
                <Text style={styles.manageLink}>Manage</Text>
              </Pressable>
            )}
          </View>
        ) : isFree ? (
          <View style={styles.currentRow}>
            <Icon name="info" size={15} color="#6B8A94" />
            <Text style={styles.freeNote}>Always included for everyone</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.getBtn,
              { backgroundColor: config.gradients[0], opacity: pressed || isLoadingThis ? 0.8 : 1 },
            ]}
            onPress={() => {
              if (!isLoggedIn) {
                Alert.alert("Sign in required", "Create a free account to upgrade.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign in", onPress: () => router.push("/(auth)/login" as never) },
                ]);
                return;
              }
              if (plan) onCheckout(plan.priceId);
            }}
            disabled={isLoadingThis}
          >
            {isLoadingThis ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.getBtnText}>
                  {tier === "trip_pass" ? "Get Trip Pass" : "Get Pro"}
                </Text>
                <Icon name="arrow-right" size={15} color="#fff" />
              </>
            )}
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Pro card with monthly / annual toggle ───────────────────────────────────

function ProBillingCard({
  monthlyPlan,
  annualPlan,
  isCurrentTier,
  loadingPriceId,
  onCheckout,
  onManage,
  isLoggedIn,
  index,
}: {
  monthlyPlan: PlanCard | null;
  annualPlan: PlanCard | null;
  isCurrentTier: boolean;
  loadingPriceId: string | null;
  onCheckout: (priceId: string) => void;
  onManage: () => void;
  isLoggedIn: boolean;
  index: number;
}) {
  const [isAnnual, setIsAnnual] = useState(true);
  const display = TIER_DISPLAY.pro;
  const config = PLAN_CONFIG.pro;

  const activePlan = isAnnual ? annualPlan : monthlyPlan;

  // Savings: compare annual price vs 12 × monthly (fallback to known prices)
  const monthlyAmt = monthlyPlan?.unitAmount ?? 699;   // in pence
  const annualAmt  = annualPlan?.unitAmount  ?? 5999;
  const annualIfMonthly = monthlyAmt * 12;
  const savingsPct = Math.round(((annualIfMonthly - annualAmt) / annualIfMonthly) * 100);
  const monthlyEquiv = (annualAmt / 100 / 12).toFixed(2);

  // Displayed price strings — fall back to hardcoded when live data unavailable
  const displayMonthlyPrice = monthlyPlan
    ? formatPrice(monthlyPlan.unitAmount, monthlyPlan.currency)
    : FALLBACK_PRICES.pro.amount;
  const displayAnnualPrice = annualPlan
    ? formatPrice(annualPlan.unitAmount, annualPlan.currency)
    : FALLBACK_PRO_ANNUAL.amount;

  const isLoading = !!activePlan && loadingPriceId === activePlan.priceId;

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100).springify().damping(16)}
      style={[styles.planCard, styles.planCardFeatured]}
    >
      {isAnnual && (
        <View style={styles.bestValueTag}>
          <Icon name="award" size={11} color="#fff" />
          <Text style={styles.bestValueText}>BEST VALUE</Text>
        </View>
      )}

      <LinearGradient
        colors={config.gradients}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardIconWrap}>
            <Icon name={config.icon} size={18} color="rgba(255,255,255,0.9)" />
          </View>
          <View style={styles.tierPill}>
            <Text style={styles.tierPillText}>{display.badge}</Text>
          </View>
        </View>

        <Text style={styles.cardName}>{display.label}</Text>

        {/* Billing period toggle */}
        <View style={styles.billingToggle}>
          <Pressable
            style={[styles.billingOption, !isAnnual && styles.billingOptionActive]}
            onPress={() => setIsAnnual(false)}
          >
            <Text style={[styles.billingOptionText, !isAnnual && styles.billingOptionTextActive]}>
              Monthly
            </Text>
          </Pressable>
          <Pressable
            style={[styles.billingOption, isAnnual && styles.billingOptionActive]}
            onPress={() => setIsAnnual(true)}
          >
            <Text style={[styles.billingOptionText, isAnnual && styles.billingOptionTextActive]}>
              Annual
            </Text>
            {annualPlan && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>Save {savingsPct}%</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Price */}
        <View style={styles.priceRow}>
          <Text style={styles.priceAmount}>
            {isAnnual ? displayAnnualPrice : displayMonthlyPrice}
          </Text>
          <Text style={styles.priceInterval}>
            {" / "}{isAnnual ? "year" : "month"}
          </Text>
        </View>
        {isAnnual && (
          <Text style={styles.priceEquiv}>
            ≈ £{monthlyEquiv} / month — save £{((annualIfMonthly - annualAmt) / 100).toFixed(2)} a year
          </Text>
        )}

        {/* Features */}
        <View style={styles.featureList}>
          {display.features.map((f) => (
            <FeatureItem key={f} text={f} dark />
          ))}
        </View>
      </LinearGradient>

      {/* CTA footer */}
      <View style={styles.cardFooter}>
        {isCurrentTier ? (
          <View style={styles.currentRow}>
            <Icon name="check-circle" size={15} color="#1C7C8C" />
            <Text style={styles.currentLabel}>Your current plan</Text>
            <Pressable onPress={onManage} hitSlop={8}>
              <Text style={styles.manageLink}>Manage</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.getBtn,
              { backgroundColor: config.gradients[0], opacity: pressed || isLoading ? 0.8 : 1 },
            ]}
            onPress={() => {
              if (!isLoggedIn) {
                Alert.alert("Sign in required", "Create a free account to upgrade.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Sign in", onPress: () => router.push("/(auth)/login" as never) },
                ]);
                return;
              }
              if (activePlan) onCheckout(activePlan.priceId);
            }}
            disabled={isLoading || !activePlan}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.getBtnText}>
                  Get Pro — {isAnnual ? "Annual" : "Monthly"}
                </Text>
                <Icon name="arrow-right" size={15} color="#fff" />
              </>
            )}
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Comparison row ──────────────────────────────────────────────────────────

function CompareRow({
  label,
  free,
  pass,
  pro,
  colors,
}: {
  label: string;
  free: string | boolean;
  pass: string | boolean;
  pro: string | boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const cell = (val: string | boolean) => {
    if (typeof val === "boolean") {
      return val ? (
        <Icon name="check" size={16} color={colors.primary} />
      ) : (
        <Icon name="x" size={16} color={colors.mutedForeground} />
      );
    }
    return <Text style={[styles.compareVal, { color: colors.foreground }]}>{val}</Text>;
  };

  return (
    <View style={[styles.compareRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.compareLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.compareCell}>{cell(free)}</View>
      <View style={styles.compareCell}>{cell(pass)}</View>
      <View style={styles.compareCell}>{cell(pro)}</View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { tier: currentTier, refresh } = useSubscription();
  const { data: productsData, isLoading: productsLoading } = useStripeProducts();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  const plans = buildPlans(productsData?.products ?? []);

  const findPlan = (tier: Tier, preferAnnual = false): PlanCard | null => {
    const tierPlans = plans.filter((p) => p.tier === tier);
    if (preferAnnual) {
      const annual = tierPlans.find((p) => p.interval === "year");
      if (annual) return annual;
    }
    return tierPlans[0] ?? null;
  };

  const handleCheckout = async (priceId: string) => {
    setLoadingPriceId(priceId);
    try {
      const data = await customFetch<{ url?: string; error?: string }>("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (!data.url) throw new Error("No checkout URL");
      await Linking.openURL(data.url);
      refresh();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } }).data;
      Alert.alert("Unable to start checkout", body?.error ?? "Something went wrong. Please try again.");
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleManage = async () => {
    setLoadingPriceId("portal");
    try {
      const data = await customFetch<{ url?: string }>("/api/stripe/portal", { method: "POST" });
      if (!data.url) throw new Error();
      await Linking.openURL(data.url);
      refresh();
    } catch {
      Alert.alert("Error", "Unable to open billing portal. Please try again.");
    } finally {
      setLoadingPriceId(null);
    }
  };

  const tripPassPlan = findPlan("trip_pass");
  const proMonthlyPlan = findPlan("pro");
  const proAnnualPlan = findPlan("pro", true);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 8, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={[styles.headline, { color: colors.foreground }]}>Plans & Pricing</Text>
        <Text style={[styles.subline, { color: colors.mutedForeground }]}>
          From your first trip to a new life abroad — HOLTO grows with you.
        </Text>
      </Animated.View>

      {/* Current plan pill */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <View style={[styles.currentBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.currentDot, { backgroundColor: TIER_DISPLAY[currentTier].badgeColor }]} />
          <Text style={[styles.currentBannerText, { color: colors.foreground }]}>
            You're on{" "}
            <Text style={{ fontFamily: "Inter_700Bold", color: TIER_DISPLAY[currentTier].badgeColor }}>
              {TIER_DISPLAY[currentTier].label}
            </Text>
          </Text>
        </View>
      </Animated.View>

      {/* Plan cards */}
      {productsLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading plans…</Text>
        </View>
      ) : (
        <View style={styles.cardsList}>
          {/* Free */}
          <PlanTierCard
            tier="free"
            plan={null}
            isCurrentTier={currentTier === "free"}
            onCheckout={handleCheckout}
            onManage={handleManage}
            isLoggedIn={!!token}
            index={0}
          />

          {/* Trip Pass */}
          <PlanTierCard
            tier="trip_pass"
            plan={tripPassPlan}
            isCurrentTier={currentTier === "trip_pass"}
            isLoadingThis={!!tripPassPlan && loadingPriceId === tripPassPlan.priceId}
            onCheckout={handleCheckout}
            onManage={handleManage}
            isLoggedIn={!!token}
            index={1}
          />

          {/* Pro — single card with monthly / annual toggle */}
          <ProBillingCard
            monthlyPlan={proMonthlyPlan?.interval !== "year" ? proMonthlyPlan : null}
            annualPlan={proAnnualPlan?.interval === "year" ? proAnnualPlan : null}
            isCurrentTier={currentTier === "pro"}
            loadingPriceId={loadingPriceId}
            onCheckout={handleCheckout}
            onManage={handleManage}
            isLoggedIn={!!token}
            index={2}
          />
        </View>
      )}

      {/* Comparison table */}
      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          FEATURE COMPARISON
        </Text>

        <View style={[styles.compareTable, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Column headers */}
          <View style={[styles.compareRow, styles.compareHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.compareLabel, { color: colors.mutedForeground }]} />
            <View style={styles.compareCell}>
              <Text style={[styles.compareColLabel, { color: colors.mutedForeground }]}>Free</Text>
            </View>
            <View style={styles.compareCell}>
              <Text style={[styles.compareColLabel, { color: "#0d9488" }]}>Pass</Text>
            </View>
            <View style={styles.compareCell}>
              <Text style={[styles.compareColLabel, { color: "#7c3aed" }]}>Pro</Text>
            </View>
          </View>

          <CompareRow label="Flight searches" free="5/day" pass="∞" pro="∞" colors={colors} />
          <CompareRow label="Ask HOLTO AI" free={false} pass={true} pro={true} colors={colors} />
          <CompareRow label="Live flight monitor" free={false} pass={true} pro={true} colors={colors} />
          <CompareRow label="EU261 calculator" free={false} pass={true} pro={true} colors={colors} />
          <CompareRow label="Relocation data" free="Basic" pass="Full" pro="Full" colors={colors} />
          <CompareRow label="AI queries" free={false} pass="Unlimited" pro="Unlimited" colors={colors} />
          <CompareRow label="Duration" free="Forever" pass="7 days" pro="Ongoing" colors={colors} />
        </View>
      </Animated.View>

      {/* Footer */}
      <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
        Payments processed securely by Stripe. Cancel or manage your plan anytime.
      </Text>
    </ScrollView>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 12,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 4,
    gap: 6,
  },
  headline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  subline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  currentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  currentBannerText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  cardsList: {
    gap: 14,
  },

  // Plan card
  planCard: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#0A2E38",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 4,
  },
  planCardFeatured: {
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  bestValueTag: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#C9A24B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bestValueText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  cardGradient: {
    padding: 20,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  tierPill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierPillText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  cardName: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: -4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  priceAmount: {
    color: "#fff",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
  },
  priceInterval: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  featureList: {
    gap: 9,
    marginTop: 4,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  featureItemText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 19,
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  currentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#1C7C8C",
  },
  manageLink: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#1C7C8C",
  },
  freeNote: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#6B8A94",
  },
  getBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  getBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  // Comparison table
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginTop: 8,
    marginLeft: 4,
  },
  compareTable: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareHeader: {
    paddingVertical: 10,
  },
  compareLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  compareColLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  compareCell: {
    width: 60,
    alignItems: "center",
  },
  compareVal: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },

  footerNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },

  // Billing toggle (inside Pro card)
  billingToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 11,
    padding: 3,
    gap: 2,
  },
  billingOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  billingOptionActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  billingOptionText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  billingOptionTextActive: {
    color: "#fff",
  },
  saveBadge: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saveBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  priceEquiv: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -6,
  },
});
