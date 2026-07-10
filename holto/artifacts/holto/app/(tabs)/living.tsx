import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Linking } from "react-native";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const DESTINATIONS = [
  {
    code: "HRG",
    name: "Hurghada",
    tagline: "Red Sea year-round sunshine",
    emoji: "🌊",
    highlights: ["330 sunny days/year", "World-class diving", "Direct UK flights"],
    monthlyBudget: "~£560",
    rent1br: "£150–300",
    weather: "28°C avg",
    color: "#1C7C8C",
  },
  {
    code: "SSH",
    name: "Sharm el-Sheikh",
    tagline: "Luxury resorts & coral reefs",
    emoji: "🐠",
    highlights: ["Naama Bay nightlife", "Snorkelling UNESCO reef", "Private beaches"],
    monthlyBudget: "~£860",
    rent1br: "£250–490",
    weather: "29°C avg",
    color: "#3FB5C4",
  },
  {
    code: "CAI",
    name: "Cairo & Alexandria",
    tagline: "Culture, history, and cosmopolitan life",
    emoji: "🏛️",
    highlights: ["Rich cultural heritage", "Thriving expat scene", "International schools"],
    monthlyBudget: "~£430",
    rent1br: "£115–185",
    weather: "25°C avg",
    color: "#C9A24B",
  },
];

type CostRow = { label: string; uk: string; egypt: string; icon: "home" | "zap" | "shopping-bag" | "coffee" | "activity" | "trending-up" };

const COST_ROWS_BY_CODE: Record<string, CostRow[]> = {
  HRG: [
    { label: "1-bed apartment (sea view)", uk: "£1,800", egypt: "£280", icon: "home" },
    { label: "Utilities (elec, water, internet)", uk: "£280", egypt: "£55", icon: "zap" },
    { label: "Food shopping (monthly)", uk: "£380", egypt: "£100", icon: "shopping-bag" },
    { label: "Dining out (per meal)", uk: "£20", egypt: "£3", icon: "coffee" },
    { label: "Private healthcare visit", uk: "£120", egypt: "£25", icon: "activity" },
    { label: "Gym membership", uk: "£54", egypt: "£18", icon: "trending-up" },
  ],
  SSH: [
    { label: "1-bed apartment (sea view)", uk: "£1,800", egypt: "£490", icon: "home" },
    { label: "Utilities (elec, water, internet)", uk: "£280", egypt: "£90", icon: "zap" },
    { label: "Food shopping (monthly)", uk: "£380", egypt: "£130", icon: "shopping-bag" },
    { label: "Dining out (per meal)", uk: "£20", egypt: "£5", icon: "coffee" },
    { label: "Private healthcare visit", uk: "£120", egypt: "£30", icon: "activity" },
    { label: "Gym membership", uk: "£54", egypt: "£20", icon: "trending-up" },
  ],
  CAI: [
    { label: "1-bed apartment (city area)", uk: "£1,800", egypt: "£180", icon: "home" },
    { label: "Utilities (elec, water, internet)", uk: "£280", egypt: "£50", icon: "zap" },
    { label: "Food shopping (monthly)", uk: "£380", egypt: "£90", icon: "shopping-bag" },
    { label: "Dining out (per meal)", uk: "£20", egypt: "£5", icon: "coffee" },
    { label: "Private healthcare visit", uk: "£120", egypt: "£35", icon: "activity" },
    { label: "Gym membership", uk: "£54", egypt: "£15", icon: "trending-up" },
  ],
};

const BUDGET_TOTALS_BY_CODE: Record<string, { uk: string; egypt: string; saving: string }> = {
  HRG: { uk: "~£3,000", egypt: "~£560", saving: "£2,440/month · £29,280/year" },
  SSH: { uk: "~£3,000", egypt: "~£860", saving: "£2,140/month · £25,680/year" },
  CAI: { uk: "~£3,000", egypt: "~£430", saving: "£2,570/month · £30,840/year" },
};

interface BudgetNumbers {
  rent: number;
  utilities: number;
  food: number;
  dining: number;
  healthcare: number;
  gym: number;
  monthlyTotal: number;
}

interface LiveCostData {
  HRG: BudgetNumbers;
  SSH: BudgetNumbers;
  CAI: BudgetNumbers;
  LON: BudgetNumbers;
  cachedUntil: string;
}

function fmtGBP(n: number): string {
  return `£${n.toLocaleString("en-GB")}`;
}

function buildCostRows(live: BudgetNumbers, lon: BudgetNumbers, code: string): CostRow[] {
  return [
    { label: code === "CAI" ? "1-bed apartment (city area)" : "1-bed apartment (sea view)", uk: fmtGBP(lon.rent), egypt: fmtGBP(live.rent), icon: "home" },
    { label: "Utilities (elec, water, internet)", uk: fmtGBP(lon.utilities), egypt: fmtGBP(live.utilities), icon: "zap" },
    { label: "Food shopping (monthly)", uk: fmtGBP(lon.food), egypt: fmtGBP(live.food), icon: "shopping-bag" },
    { label: "Dining out (per meal)", uk: fmtGBP(lon.dining), egypt: fmtGBP(live.dining), icon: "coffee" },
    { label: "Private healthcare visit", uk: fmtGBP(lon.healthcare), egypt: fmtGBP(live.healthcare), icon: "activity" },
    { label: "Gym membership", uk: fmtGBP(lon.gym), egypt: fmtGBP(live.gym), icon: "trending-up" },
  ];
}

function buildTotals(live: BudgetNumbers, lon: BudgetNumbers): { uk: string; egypt: string; saving: string } {
  const saving = lon.monthlyTotal - live.monthlyTotal;
  return {
    uk: `~${fmtGBP(lon.monthlyTotal)}`,
    egypt: `~${fmtGBP(live.monthlyTotal)}`,
    saving: `${fmtGBP(saving)}/month · ${fmtGBP(saving * 12)}/year`,
  };
}

const LIFESTYLE_ITEMS = [
  { icon: "sun" as const, label: "Year-round sunshine", color: "#C9A24B" },
  { icon: "shield" as const, label: "Affordable healthcare", color: "#2ECC71" },
  { icon: "wifi" as const, label: "Fast broadband available", color: "#3498DB" },
  { icon: "users" as const, label: "Established expat community", color: "#9B59B6" },
  { icon: "book-open" as const, label: "International schools", color: "#E67E22" },
  { icon: "map-pin" as const, label: "EU flight under 5 hours", color: "#1C7C8C" },
];

const GUIDES = [
  { title: "Hurghada Living Guide", subtitle: "Everything to know before you move", icon: "book" as const },
  { title: "Egypt Visa & Banking", subtitle: "Residency, accounts, and legalities", icon: "file-text" as const },
  { title: "Red Sea Property Guide", subtitle: "Buying and renting as a foreigner", icon: "key" as const },
];

export default function LivingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedDest, setSelectedDest] = useState(0);

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  const { data: liveData } = useQuery<LiveCostData>({
    queryKey: ["cost-of-living"],
    queryFn: async () => {
      const res = await fetch("/api/cost-of-living");
      if (!res.ok) throw new Error("fetch failed");
      return res.json() as Promise<LiveCostData>;
    },
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const dest = DESTINATIONS[selectedDest];
  const liveCity = liveData?.[dest.code as "HRG" | "SSH" | "CAI"];
  const liveLon = liveData?.LON;

  const costRows =
    liveCity && liveLon
      ? buildCostRows(liveCity, liveLon, dest.code)
      : (COST_ROWS_BY_CODE[dest.code] ?? COST_ROWS_BY_CODE["HRG"]!);

  const budgetTotals =
    liveCity && liveLon
      ? buildTotals(liveCity, liveLon)
      : (BUDGET_TOTALS_BY_CODE[dest.code] ?? BUDGET_TOTALS_BY_CODE["HRG"]!);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#0A2E38", "#1C7C8C"]}
        style={[styles.hero, { paddingTop: topPad + 20 }]}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.heroBadge}>
            <View style={styles.greenDot} />
            <Text style={styles.heroBadgeText}>HOLTO LIVING</Text>
          </View>
          <Text style={styles.heroTitle}>Life Beyond{"\n"}the Flight</Text>
          <Text style={styles.heroSubtitle}>
            Join thousands of Brits who've made the Red Sea their home. Lower costs, better weather, richer life.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>£1,800+</Text>
              <Text style={styles.heroStatLabel}>avg monthly saving</Text>
            </View>
            <View style={[styles.heroStatDivider]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>330</Text>
              <Text style={styles.heroStatLabel}>sunny days/year</Text>
            </View>
            <View style={[styles.heroStatDivider]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatNum}>4h 30m</Text>
              <Text style={styles.heroStatLabel}>from London</Text>
            </View>
          </View>
        </Animated.View>
      </LinearGradient>

      <View style={styles.body}>
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Choose Your Destination</Text>
          <View style={styles.destPicker}>
            {DESTINATIONS.map((d, i) => (
              <Pressable
                key={d.code}
                onPress={() => setSelectedDest(i)}
                style={[
                  styles.destTab,
                  {
                    backgroundColor: selectedDest === i ? d.color : colors.card,
                    borderColor: selectedDest === i ? d.color : colors.border,
                  },
                ]}
              >
                <Text style={styles.destTabEmoji}>{d.emoji}</Text>
                <Text style={[styles.destTabName, { color: selectedDest === i ? "#fff" : colors.foreground }]}>
                  {d.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.destCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <LinearGradient
              colors={[dest.color + "18", dest.color + "05"]}
              style={[styles.destCardGrad, { borderRadius: colors.radius }]}
            >
              <View style={styles.destCardHeader}>
                <View>
                  <Text style={[styles.destCardName, { color: colors.foreground }]}>{dest.emoji} {dest.name}</Text>
                  <Text style={[styles.destCardTagline, { color: colors.mutedForeground }]}>{dest.tagline}</Text>
                </View>
                <View style={[styles.budgetBadge, { backgroundColor: dest.color }]}>
                  <Text style={styles.budgetBadgeLabel}>FROM</Text>
                  <Text style={styles.budgetBadgeAmount}>{dest.monthlyBudget}</Text>
                  <Text style={styles.budgetBadgeUnit}>/month</Text>
                </View>
              </View>

              <View style={styles.destGrid}>
                <View style={[styles.destMetaItem, { backgroundColor: colors.background }]}>
                  <Icon name="home" size={14} color={dest.color} />
                  <View>
                    <Text style={[styles.destMetaLabel, { color: colors.mutedForeground }]}>1BR Rent</Text>
                    <Text style={[styles.destMetaValue, { color: colors.foreground }]}>{dest.rent1br}</Text>
                  </View>
                </View>
                <View style={[styles.destMetaItem, { backgroundColor: colors.background }]}>
                  <Icon name="sun" size={14} color={dest.color} />
                  <View>
                    <Text style={[styles.destMetaLabel, { color: colors.mutedForeground }]}>Weather</Text>
                    <Text style={[styles.destMetaValue, { color: colors.foreground }]}>{dest.weather}</Text>
                  </View>
                </View>
              </View>

              <View style={{ gap: 8, marginTop: 14 }}>
                {dest.highlights.map((h) => (
                  <View key={h} style={styles.highlightRow}>
                    <View style={[styles.highlightDot, { backgroundColor: dest.color }]} />
                    <Text style={[styles.highlightText, { color: colors.foreground }]}>{h}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={{ marginTop: 28 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Monthly Budget Comparison</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              London vs. {dest.name} · {liveData ? "live Numbeo data" : "2026 data"}
            </Text>
            {liveData && (
              <View style={{ backgroundColor: "#2ECC7122", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, color: "#2ECC71", fontFamily: "Inter_600SemiBold" }}>LIVE</Text>
              </View>
            )}
          </View>
          <View style={[styles.budgetTable, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.budgetTableHeader}>
              <Text style={[styles.budgetColHead, { color: colors.mutedForeground, flex: 1 }]}>Category</Text>
              <Text style={[styles.budgetColHead, { color: colors.mutedForeground, width: 70, textAlign: "right" }]}>London</Text>
              <Text style={[styles.budgetColHead, { color: dest.color, width: 70, textAlign: "right" }]}>{dest.code === "CAI" ? "Cairo" : "Egypt"}</Text>
            </View>
            {costRows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.budgetRow,
                  { borderTopColor: colors.border },
                  i === 0 ? { borderTopWidth: 0 } : { borderTopWidth: 1 },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Icon name={row.icon} size={13} color={colors.mutedForeground} />
                  <Text style={[styles.budgetRowLabel, { color: colors.foreground }]}>{row.label}</Text>
                </View>
                <Text style={[styles.budgetRowUk, { color: colors.mutedForeground }]}>{row.uk}</Text>
                <Text style={[styles.budgetRowEg, { color: dest.color }]}>{row.egypt}</Text>
              </View>
            ))}
            <View style={[styles.budgetTotalRow, { borderTopColor: colors.border, backgroundColor: dest.color + "12" }]}>
              <Text style={[styles.budgetTotalLabel, { color: colors.foreground }]}>Estimated total</Text>
              <Text style={[styles.budgetTotalUk, { color: colors.mutedForeground }]}>{budgetTotals.uk}</Text>
              <Text style={[styles.budgetTotalEg, { color: dest.color }]}>{budgetTotals.egypt}</Text>
            </View>
            <View style={[styles.savingBanner, { backgroundColor: dest.color }]}>
              <Icon name="trending-down" size={16} color="#fff" />
              <Text style={styles.savingBannerText}>Average saving: {budgetTotals.saving}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(400)} style={{ marginTop: 28 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lifestyle Highlights</Text>
          <View style={styles.lifestyleGrid}>
            {LIFESTYLE_ITEMS.map((item) => (
              <View
                key={item.label}
                style={[styles.lifestyleItem, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
              >
                <View style={[styles.lifestyleIcon, { backgroundColor: item.color + "18" }]}>
                  <Icon name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={[styles.lifestyleLabel, { color: colors.foreground }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(400)} style={{ marginTop: 28 }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>HOLTO Guides</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Expert-written PDF guides for your move abroad
          </Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            {GUIDES.map((guide) => (
              <Pressable
                key={guide.title}
                onPress={() => Linking.openURL("https://www.holtotravel.com")}
                style={({ pressed }) => [
                  styles.guideCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={[styles.guideIconWrap, { backgroundColor: colors.primary + "15" }]}>
                  <Icon name={guide.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.guideTitle, { color: colors.foreground }]}>{guide.title}</Text>
                  <Text style={[styles.guideSub, { color: colors.mutedForeground }]}>{guide.subtitle}</Text>
                </View>
                <View style={[styles.guideBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.guideBadgeText, { color: colors.primary }]}>View</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(400)} style={{ marginTop: 28 }}>
          <LinearGradient
            colors={["#0A2E38", "#1C7C8C"]}
            style={[styles.ctaBanner, { borderRadius: colors.radius }]}
          >
            <View style={styles.ctaContent}>
              <Text style={styles.ctaTitle}>Ready to make the move?</Text>
              <Text style={styles.ctaSub}>
                Join the HOLTO Living community — a private network of Brits building their life in Egypt and beyond.
              </Text>
            </View>
            <Pressable
              onPress={() => Linking.openURL("https://www.holtotravel.com")}
              style={({ pressed }) => [styles.ctaBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={styles.ctaBtnText}>Explore HOLTO Living</Text>
              <Icon name="arrow-right" size={16} color="#0A2E38" />
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {},
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  greenDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#3FB5C4" },
  heroBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#3FB5C4", letterSpacing: 1.5, textTransform: "uppercase" },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 36, color: "#fff", lineHeight: 44, letterSpacing: -0.5, marginBottom: 12 },
  heroSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 22, marginBottom: 24 },
  heroStats: { flexDirection: "row", alignItems: "center" },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatNum: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff", letterSpacing: -0.3 },
  heroStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2, textAlign: "center" },
  heroStatDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)" },
  body: { paddingHorizontal: 20 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: -0.2 },
  sectionSub: { fontFamily: "Inter_400Regular", fontSize: 14, marginTop: 3 },
  destPicker: { flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 14 },
  destTab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
  },
  destTabEmoji: { fontSize: 20 },
  destTabName: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  destCard: { borderWidth: 1, overflow: "hidden" },
  destCardGrad: { padding: 18 },
  destCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 },
  destCardName: { fontFamily: "Inter_700Bold", fontSize: 20 },
  destCardTagline: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 3 },
  budgetBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  budgetBadgeLabel: { fontFamily: "Inter_500Medium", fontSize: 9, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 1 },
  budgetBadgeAmount: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  budgetBadgeUnit: { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.7)" },
  destGrid: { flexDirection: "row", gap: 10 },
  destMetaItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  destMetaLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
  destMetaValue: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  highlightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  highlightDot: { width: 6, height: 6, borderRadius: 3 },
  highlightText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  budgetTable: { borderWidth: 1, overflow: "hidden" },
  budgetTableHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  budgetColHead: { fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
  budgetRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  budgetRowLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },
  budgetRowUk: { fontFamily: "Inter_500Medium", fontSize: 13, width: 70, textAlign: "right" },
  budgetRowEg: { fontFamily: "Inter_600SemiBold", fontSize: 13, width: 70, textAlign: "right" },
  budgetTotalRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1 },
  budgetTotalLabel: { fontFamily: "Inter_700Bold", fontSize: 14, flex: 1 },
  budgetTotalUk: { fontFamily: "Inter_600SemiBold", fontSize: 14, width: 70, textAlign: "right" },
  budgetTotalEg: { fontFamily: "Inter_700Bold", fontSize: 15, width: 70, textAlign: "right" },
  savingBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  savingBannerText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },
  lifestyleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  lifestyleItem: {
    width: "47%",
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  lifestyleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  lifestyleLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  guideCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 14 },
  guideIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  guideTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  guideSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  guideBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  guideBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  ctaBanner: { padding: 24, gap: 18 },
  ctaContent: { gap: 8 },
  ctaTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  ctaSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 21 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: "flex-start",
  },
  ctaBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#0A2E38" },
});
