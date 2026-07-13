import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";

const COUNT_KEY = "holto_open_count";
const DONE_KEY = "holto_rating_done";
const THRESHOLD = 5; // opens before we ask, once
const SHARE_URL = "https://app.holtotravel.com";
const FEEDBACK = "mailto:hello@holtotravel.com?subject=HOLTO%20feedback";

/**
 * A gentle, once-only "enjoying HOLTO?" prompt after a few opens. Promoters are
 * routed to share the app (organic growth); detractors to private feedback
 * (keeps complaints out of public reviews). No store dependency — works on the
 * PWA. Renders nothing until the threshold is crossed.
 */
export function RatingPrompt() {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (await AsyncStorage.getItem(DONE_KEY)) return;
        const n = Number((await AsyncStorage.getItem(COUNT_KEY)) ?? "0") + 1;
        await AsyncStorage.setItem(COUNT_KEY, String(n));
        if (n >= THRESHOLD) setOpen(true);
      } catch {
        /* ignore storage errors */
      }
    })();
  }, []);

  function done() {
    setOpen(false);
    AsyncStorage.setItem(DONE_KEY, "1").catch(() => {});
  }

  async function love() {
    done();
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && (navigator as Navigator & { share?: unknown }).share) {
        await (navigator as unknown as { share: (d: object) => Promise<void> }).share({ title: "HOLTO", text: "My honest travel companion — flight alerts, rights and more.", url: SHARE_URL });
      } else if (Platform.OS !== "web") {
        await Share.share({ message: `HOLTO — my honest travel companion. ${SHARE_URL}` });
      } else {
        openUrl(SHARE_URL);
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  function feedback() {
    done();
    openUrl(FEEDBACK);
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={done}>
      <Pressable style={styles.backdrop} onPress={done}>
        <Pressable style={[styles.card, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <Text style={{ fontSize: 34 }}>⭐️</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Enjoying HOLTO?</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We're a small team building the honest travel companion. A quick share helps more travellers find us.
          </Text>
          <Pressable onPress={love} style={[styles.cta, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Love it — share HOLTO</Text>
          </Pressable>
          <Pressable onPress={feedback} style={styles.ghost}>
            <Text style={[styles.ghostText, { color: colors.mutedForeground }]}>Could be better — send feedback</Text>
          </Pressable>
          <Pressable onPress={done} style={styles.ghost}>
            <Text style={[styles.ghostText, { color: colors.mutedForeground }]}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 28 },
  card: { borderRadius: 22, padding: 26, alignItems: "center", alignSelf: "stretch", maxWidth: 420 },
  title: { fontFamily: "Inter_700Bold", fontSize: 21, marginTop: 12, textAlign: "center" },
  body: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  cta: { alignSelf: "stretch", height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 20 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  ghost: { height: 40, alignItems: "center", justifyContent: "center", marginTop: 4, alignSelf: "stretch" },
  ghostText: { fontFamily: "Inter_500Medium", fontSize: 14 },
});
