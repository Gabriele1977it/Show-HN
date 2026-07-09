import { Icon } from "@/components/Icon";
import { SocialIcon } from "@/components/SocialIcon";
import { customFetch } from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { router } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useSubscription, useStripeProducts, type StripeProduct } from "@/hooks/useSubscription";
import { TIER_DISPLAY, PRODUCT_IDS, type Tier } from "@/constants/tiers";

// ─── helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  if (interval === "day" && count === 7) return "/ 7 days";
  if (interval === "month" && count === 1) return "/ mo";
  if (interval === "year" && count === 1) return "/ yr";
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
    const order: Record<Tier, number> = { free: 0, trip_pass: 1, pro: 2 };
    const d = order[a.tier] - order[b.tier];
    return d !== 0 ? d : a.unitAmount - b.unitAmount;
  });
  return plans;
}

const PLAN_COLORS: Record<Tier, [string, string]> = {
  free: ["#4B6A72", "#2D4A52"],
  trip_pass: ["#1C7C8C", "#0e5566"],
  pro: ["#7c3aed", "#5b21b6"],
};

const TIER_ORDER: Record<Tier, number> = { free: 0, trip_pass: 1, pro: 2 };

// ─── settings row ────────────────────────────────────────────────────────────

function SettingsRow({
  icon,
  label,
  onPress,
  destructive = false,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        {
          backgroundColor: pressed
            ? destructive
              ? "#C9404008"
              : colors.muted + "80"
            : "transparent",
        },
      ]}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.settingsIcon,
          {
            backgroundColor: destructive ? "#C94040" + "18" : colors.primary + "18",
          },
        ]}
      >
        <Icon
          name={icon}
          size={17}
          color={destructive ? "#C94040" : colors.primary}
        />
      </View>
      <Text
        style={[
          styles.settingsLabel,
          { color: destructive ? "#C94040" : colors.foreground },
        ]}
      >
        {label}
      </Text>
      {!destructive && (
        <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

// ─── plan card ───────────────────────────────────────────────────────────────

function PlanOptionCard({
  plan,
  currentTier,
  loadingPriceId,
  onCheckout,
  colors,
  isBestValue,
}: {
  plan: PlanCard;
  currentTier: Tier;
  loadingPriceId: string | null;
  onCheckout: (priceId: string) => void;
  colors: ReturnType<typeof useColors>;
  isBestValue?: boolean;
}) {
  const display = TIER_DISPLAY[plan.tier];
  const isCurrentTier = currentTier === plan.tier;
  const isLoading = loadingPriceId === plan.priceId;
  const gradColors = PLAN_COLORS[plan.tier];

  return (
    <Animated.View entering={FadeInDown.springify()}>
      {isBestValue && (
        <View style={[styles.bestValueBadge, { backgroundColor: colors.accent }]}>
          <Text style={styles.bestValueText}>BEST VALUE</Text>
        </View>
      )}
      <View
        style={[
          styles.planCard,
          isBestValue && styles.planCardFeatured,
          {
            borderColor: isCurrentTier
              ? colors.primary
              : isBestValue
                ? colors.accent
                : colors.border,
          },
        ]}
      >
        <LinearGradient
          colors={gradColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.planCardGradient}
        >
          <View style={styles.planCardTop}>
            <View>
              <Text style={styles.planCardName}>{plan.name}</Text>
              <View style={styles.planCardPriceRow}>
                <Text style={styles.planCardPrice}>
                  {formatPrice(plan.unitAmount, plan.currency)}
                </Text>
                <Text style={styles.planCardInterval}>
                  {" "}
                  {intervalLabel(plan.interval, plan.intervalCount)}
                </Text>
              </View>
            </View>
            <View style={[styles.tierPill, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
              <Text style={styles.tierPillText}>{display.badge}</Text>
            </View>
          </View>

          <View style={styles.planFeatures}>
            {display.features.map((f) => (
              <View key={f} style={styles.planFeatureRow}>
                <Icon name="check" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.planFeatureText}>{f}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {isCurrentTier ? (
          <View style={[styles.planCardFooter, { backgroundColor: colors.card }]}>
            <Icon name="check-circle" size={15} color={colors.primary} />
            <Text style={[styles.planCurrentText, { color: colors.primary }]}>
              Active plan
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => onCheckout(plan.priceId)}
            disabled={!!loadingPriceId}
            style={({ pressed }) => [
              styles.planCardFooter,
              styles.planCardFooterBtn,
              { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <>
                <Text style={[styles.planBtnText, { color: colors.primary }]}>
                  Get {plan.name}
                </Text>
                <Icon name="arrow-right" size={15} color={colors.primary} />
              </>
            )}
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { tier: currentTier, refresh } = useSubscription();
  const { data: productsData, isLoading: productsLoading } = useStripeProducts();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const plans = buildPlans(productsData?.products ?? []);
  const upgradePlans = plans.filter((p) => TIER_ORDER[p.tier] > TIER_ORDER[currentTier]);
  const tierDisplay = TIER_DISPLAY[currentTier];

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

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

  const openManageSheet = () => {
    const canUpgrade = upgradePlans.length > 0;
    const buttons: Parameters<typeof Alert.alert>[2] = [];

    if (canUpgrade) {
      buttons.push({
        text: "View Upgrade Options",
        onPress: () => router.push("/(tabs)/plans" as never),
      });
    }

    buttons.push({
      text: "Manage Subscription (Stripe)",
      onPress: () => void handlePortal(),
    });

    buttons.push({ text: "Cancel", style: "cancel" });

    Alert.alert(
      "Manage Plan",
      currentTier === "free"
        ? "Choose an option below to upgrade or manage your account."
        : "Upgrade, downgrade, or cancel your subscription.",
      buttons,
    );
  };

  const handlePortal = async () => {
    setLoadingPriceId("portal");
    try {
      const data = await customFetch<{ url?: string; error?: string }>("/api/stripe/portal", {
        method: "POST",
      });
      if (!data.url) throw new Error("No portal URL");
      await Linking.openURL(data.url);
      refresh();
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string } }).data;
      const message = body?.error ?? "Something went wrong.";
      Alert.alert(
        "Billing Portal",
        message.includes("customer")
          ? "No billing record found. Please purchase a plan first to access the billing portal."
          : message,
        [
          { text: "View Plans", onPress: () => router.push("/(tabs)/plans" as never) },
          { text: "OK", style: "cancel" },
        ],
      );
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleEmail = async () => {
    const url = "mailto:hello@holtotravel.com";
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert(
        "Contact Support",
        "Email us at:\nhello@holtotravel.com",
        [{ text: "OK" }],
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);
  };

  const initials = user ? getInitials(user.name) : "?";

  // ── Logged-out state ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 16, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.profileSection}>
          <View style={[styles.avatar, { backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
            <Icon name="user" size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            Not signed in
          </Text>
          <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
            Sign in to manage your plan and preferences
          </Text>
          <Pressable
            onPress={() => router.push("/(auth)/login" as never)}
            style={({ pressed }) => [
              styles.signInBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Icon name="arrow-right" size={16} color="#fff" />
            <Text style={styles.signInBtnText}>Sign In</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SUPPORT</Text>
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow
              icon="help-circle"
              label="Help & Support"
              onPress={() => void handleEmail()}
              colors={colors}
            />
            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            <SettingsRow
              icon="globe"
              label="Visit holtotravel.co.uk"
              onPress={() => void Linking.openURL("https://www.holtotravel.co.uk")}
              colors={colors}
            />
            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            <SettingsRow
              icon="file-text"
              label="Terms of Service"
              onPress={() => router.push("/legal/terms")}
              colors={colors}
            />
            <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            <SettingsRow
              icon="shield"
              label="Privacy Policy"
              onPress={() => router.push("/legal/privacy")}
              colors={colors}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>FOLLOW US</Text>
          <View style={styles.socialRow}>
            {SOCIAL_LINKS.map((s) => (
              <Pressable
                key={s.name}
                onPress={() => void Linking.openURL(s.url)}
                style={({ pressed }) => [
                  styles.socialBtn,
                  { backgroundColor: s.color, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <SocialIcon name={s.name} size={20} />
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
          HOLTO · Version 1.0
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: topPad + 16, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile header ── */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.profileSection}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>

        <Text style={[styles.profileName, { color: colors.foreground }]}>
          {user?.name ?? "—"}
        </Text>
        <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
          {user?.email ?? "—"}
        </Text>

        <View
          style={[
            styles.tierBadge,
            { backgroundColor: tierDisplay.badgeColor + "22" },
          ]}
        >
          <View style={[styles.tierDot, { backgroundColor: tierDisplay.badgeColor }]} />
          <Text style={[styles.tierBadgeLabel, { color: tierDisplay.badgeColor }]}>
            {tierDisplay.label}
          </Text>
        </View>
      </Animated.View>

      {/* ── Current Plan ── */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          YOUR PLAN
        </Text>
        <View style={[styles.currentPlanCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.currentPlanRow}>
            <View>
              <Text style={[styles.currentPlanName, { color: colors.foreground }]}>
                {tierDisplay.label}
              </Text>
              <Text style={[styles.currentPlanSub, { color: colors.mutedForeground }]}>
                {currentTier === "free"
                  ? "Basic access · Free forever"
                  : currentTier === "trip_pass"
                    ? "7-day full access pass"
                    : "Full access · Ongoing"}
              </Text>
            </View>
            {currentTier !== "free" && (
              <Pressable
                onPress={openManageSheet}
                disabled={!!loadingPriceId}
                style={({ pressed }) => [
                  styles.manageBtn,
                  { backgroundColor: colors.primary + "18", opacity: pressed ? 0.7 : 1 },
                ]}
              >
                {loadingPriceId === "portal" ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={[styles.manageBtnText, { color: colors.primary }]}>
                    Manage
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.featureGrid}>
            {tierDisplay.features.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Icon name="check" size={13} color={colors.primary} />
                <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
              </View>
            ))}
            {tierDisplay.lockedFeatures.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Icon name="lock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* ── Upgrade Plans ── */}
      {upgradePlans.length > 0 && (
        <Animated.View entering={FadeInDown.delay(160).duration(400)}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            UPGRADE
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.foreground }]}>
            From one trip to full expat life
          </Text>
          {productsLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.plansList}>
              {upgradePlans.map((plan, i) => {
                const isAnnual =
                  plan.interval === "year" && plan.tier === "pro";
                return (
                  <PlanOptionCard
                    key={plan.priceId}
                    plan={plan}
                    currentTier={currentTier}
                    loadingPriceId={loadingPriceId}
                    onCheckout={handleCheckout}
                    colors={colors}
                    isBestValue={isAnnual}
                  />
                );
              })}
            </View>
          )}
          <Text style={[styles.stripeNote, { color: colors.mutedForeground }]}>
            Payments secured by Stripe · Cancel anytime
          </Text>
        </Animated.View>
      )}

      {/* ── Settings ── */}
      <Animated.View entering={FadeInDown.delay(240).duration(400)}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          SUPPORT
        </Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="help-circle"
            label="Help & Support"
            onPress={() => void handleEmail()}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="globe"
            label="Visit holtotravel.co.uk"
            onPress={() => void Linking.openURL("https://www.holtotravel.co.uk")}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="file-text"
            label="Terms of Service"
            onPress={() => router.push("/legal/terms")}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="shield"
            label="Privacy Policy"
            onPress={() => router.push("/legal/privacy")}
            colors={colors}
          />
        </View>
      </Animated.View>

      {/* ── Sign out ── */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)}>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingsRow
            icon="log-out"
            label="Sign out"
            onPress={handleSignOut}
            destructive
            colors={colors}
          />
        </View>
      </Animated.View>

      {/* ── Follow us ── */}
      <Animated.View entering={FadeInDown.delay(360).duration(400)}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>FOLLOW US</Text>
        <View style={styles.socialRow}>
          {SOCIAL_LINKS.map((s) => (
            <Pressable
              key={s.name}
              onPress={() => void Linking.openURL(s.url)}
              style={({ pressed }) => [
                styles.socialBtn,
                { backgroundColor: s.color, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <SocialIcon name={s.name} size={20} />
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <Text style={[styles.versionText, { color: colors.mutedForeground }]}>
        HOLTO · Version 1.0
      </Text>
    </ScrollView>
  );
}

// ─── Social media links ───────────────────────────────────────────────────────

const SOCIAL_LINKS = [
  {
    name: "instagram" as const,
    color: "#E1306C",
    url: "https://www.instagram.com/holtotravel/",
  },
  {
    name: "facebook" as const,
    color: "#1877F2",
    url: "https://www.facebook.com/profile.php?id=61590540654654",
  },
  {
    name: "youtube" as const,
    color: "#FF0000",
    url: "https://www.youtube.com/@holtotravel",
  },
  {
    name: "twitter_x" as const,
    color: "#000000",
    url: "https://x.com/GabrieleOliva16",
  },
];

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 8,
  },

  // Profile
  profileSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 28,
    gap: 8,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  profileName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  tierDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tierBadgeLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  // Sections
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    marginLeft: 4,
  },

  // Current plan card
  currentPlanCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  currentPlanRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  currentPlanName: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 3,
  },
  currentPlanSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  manageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },
  manageBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  featureGrid: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 20,
  },

  // Plan option cards
  plansList: {
    gap: 12,
  },
  bestValueBadge: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: -1,
    zIndex: 1,
  },
  bestValueText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  planCardFeatured: {
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  planCardGradient: {
    padding: 18,
    gap: 14,
  },
  planCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planCardName: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  planCardPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  planCardPrice: {
    color: "#fff",
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  planCardInterval: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  tierPill: {
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
  planFeatures: {
    gap: 8,
  },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planFeatureText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 19,
  },
  planCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  planCardFooterBtn: {},
  planCurrentText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  planBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },

  // Settings
  settingsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },

  // Misc
  loadingRow: {
    padding: 24,
    alignItems: "center",
  },
  stripeNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
  versionText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 4,
  },

  // Social media
  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 8,
  },
  socialBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  // Logged-out sign-in button
  signInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 8,
  },
  signInBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
