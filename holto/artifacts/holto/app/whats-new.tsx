import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { CHANGELOG } from "@/constants/changelog";
import { useColors } from "@/hooks/useColors";

export default function WhatsNewScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Go back">
        <Icon name="arrow-left" size={22} color={colors.foreground} />
      </Pressable>

      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>What's new</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>The latest improvements to HOLTO.</Text>
      </Animated.View>

      {CHANGELOG.map((entry, ei) => (
        <Animated.View key={entry.id} entering={FadeInDown.delay(60 + ei * 40).duration(400)} style={{ marginTop: 24 }}>
          <Text style={[styles.entryTitle, { color: colors.foreground }]}>{entry.title}</Text>
          <Text style={[styles.entryDate, { color: colors.mutedForeground }]}>{entry.date}</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {entry.items.map((it, i) => (
              <View key={i} style={[styles.row, i > 0 && { marginTop: 14 }]}>
                <Text style={{ fontSize: 20 }}>{it.emoji}</Text>
                <Text style={[styles.itemText, { color: colors.foreground }]}>{it.text}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 44, height: 44, justifyContent: "center", marginBottom: 8, marginLeft: -8 },
  h1: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, marginTop: 6 },
  entryTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  entryDate: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  card: { borderWidth: 1, padding: 16, marginTop: 10 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  itemText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, flex: 1 },
});
