import { router } from "expo-router";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  benefits?: string[];
}

const DEFAULT_BENEFITS = [
  "Ask HOLTO anything, anytime",
  "Live flight monitoring + instant alerts",
  "Unlimited flight searches",
  "EU261 / UK261 compensation calculator",
];

// A tasteful, value-framed "this is a paid feature" prompt. Shown when the API
// returns requiresUpgrade — it sells the upgrade at the moment of intent by
// listing exactly what unlocks. Routes to the Plans tab.
export function UpgradeSheet({ visible, onClose, title = "Unlock the full HOLTO", message, benefits = DEFAULT_BENEFITS }: Props) {
  const colors = useColors();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.badge, { backgroundColor: colors.gold + "22" }]}>
            <Icon name="star" size={26} color={colors.gold} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text> : null}

          <View style={styles.benefits}>
            {benefits.map((b) => (
              <View key={b} style={styles.benefitRow}>
                <View style={[styles.tick, { backgroundColor: colors.primary + "1A" }]}>
                  <Icon name="check" size={13} color={colors.primary} />
                </View>
                <Text style={[styles.benefitText, { color: colors.foreground }]}>{b}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => {
              onClose();
              router.push("/(tabs)/plans" as never);
            }}
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>See plans</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.ghost}>
            <Text style={[styles.ghostText, { color: colors.mutedForeground }]}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 36, alignItems: "center" },
  badge: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, textAlign: "center" },
  message: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, maxWidth: 320 },
  benefits: { alignSelf: "stretch", gap: 12, marginTop: 20 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  benefitText: { fontFamily: "Inter_500Medium", fontSize: 14, flex: 1 },
  cta: { alignSelf: "stretch", height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 22 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  ghost: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 4, alignSelf: "stretch" },
  ghostText: { fontFamily: "Inter_500Medium", fontSize: 15 },
});
