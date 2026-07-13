import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CHANGELOG, LATEST_CHANGELOG_ID } from "@/constants/changelog";
import { useColors } from "@/hooks/useColors";

const SEEN_KEY = "holto_whatsnew_seen";

/**
 * Auto-opens once when the latest changelog entry hasn't been seen, so returning
 * users discover new features. Dismissal is remembered per release id, so it
 * never nags. Renders nothing until it's decided it should show.
 */
export function WhatsNewSheet() {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const entry = CHANGELOG[0];

  useEffect(() => {
    if (!LATEST_CHANGELOG_ID) return;
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => {
        if (seen !== LATEST_CHANGELOG_ID) setOpen(true);
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    setOpen(false);
    AsyncStorage.setItem(SEEN_KEY, LATEST_CHANGELOG_ID).catch(() => {});
  }

  if (!entry) return null;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.badge, { backgroundColor: colors.primary + "1A" }]}>
            <Text style={{ fontSize: 26 }}>🎉</Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>What's new</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{entry.title} · {entry.date}</Text>

          <ScrollView style={{ alignSelf: "stretch", marginTop: 18 }} contentContainerStyle={{ gap: 14 }}>
            {entry.items.map((it, i) => (
              <View key={i} style={styles.row}>
                <Text style={{ fontSize: 20 }}>{it.emoji}</Text>
                <Text style={[styles.itemText, { color: colors.foreground }]}>{it.text}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable onPress={dismiss} style={[styles.cta, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Got it</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 34, alignItems: "center", maxHeight: "82%" },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center" },
  subtitle: { fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center", marginTop: 4 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  itemText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, flex: 1 },
  cta: { alignSelf: "stretch", height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 20 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
