import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

interface Tool {
  emoji: string;
  title: string;
  desc: string;
  route: "/trips" | "/expenses" | "/residency" | "/airport-timing";
}

const TOOLS: Tool[] = [
  { emoji: "🧳", title: "Trips", desc: "Every flight, hotel and plan in one timeline. Paste a booking to auto-fill it.", route: "/trips" },
  { emoji: "⏱️", title: "Airport timing", desc: "When to leave for the airport, using live traffic and your flight time.", route: "/airport-timing" },
  { emoji: "🧾", title: "Expenses", desc: "Log spend in any currency, total in GBP, export a report in one tap.", route: "/expenses" },
  { emoji: "🌍", title: "Residency & tax days", desc: "Count your days per country and stay ahead of the 183-day rule.", route: "/residency" },
];

const SOON: { emoji: string; title: string }[] = [
  { emoji: "📶", title: "eSIM data plans" },
  { emoji: "🛂", title: "Visa & entry checker" },
  { emoji: "🏆", title: "Loyalty & points" },
];

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 + 60 : insets.bottom + 60;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topPad + 8, paddingBottom: bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Your Toolkit</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Everything a constant traveller needs, in one place.
        </Text>
      </Animated.View>

      <View style={{ marginTop: 20, gap: 12 }}>
        {TOOLS.map((t, i) => (
          <Animated.View key={t.route} entering={FadeInDown.delay(60 + i * 50).duration(400)}>
            <Pressable
              onPress={() => router.push(t.route)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.emojiWrap, { backgroundColor: colors.muted }]}>
                <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t.title}</Text>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{t.desc}</Text>
              </View>
              <Icon name={"chevron-right" as IconName} size={18} color={colors.mutedForeground} />
            </Pressable>
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ marginTop: 28 }}>
        <Text style={[styles.soonLabel, { color: colors.mutedForeground }]}>COMING SOON</Text>
        <View style={styles.soonRow}>
          {SOON.map((s) => (
            <View key={s.title} style={[styles.soonChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 15 }}>{s.emoji}</Text>
              <Text style={[styles.soonText, { color: colors.mutedForeground }]}>{s.title}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, marginTop: 6 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, padding: 16 },
  emojiWrap: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18, marginTop: 2 },
  soonLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8, marginBottom: 10 },
  soonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  soonChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  soonText: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
