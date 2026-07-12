import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

const DISMISS_KEY = "holto_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: string }>;
}

/**
 * A dismissible "Install HOLTO" nudge on the web/PWA. Uses the standard
 * `beforeinstallprompt` event on Chromium; on iOS Safari (which never fires it)
 * it shows the manual "Share → Add to Home Screen" hint instead. Renders
 * nothing on native or once installed/dismissed.
 */
export function InstallPrompt() {
  const colors = useColors();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (window.localStorage?.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage blocked — show anyway */
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const ua = navigator.userAgent || "";
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      window.localStorage?.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }
  async function install() {
    if (deferred) {
      try {
        deferred.prompt();
        await deferred.userChoice;
      } catch {
        /* ignore */
      }
      setDeferred(null);
    }
    dismiss();
  }

  return (
    <View style={[styles.bar, colors.shadow, { backgroundColor: colors.midnight, borderRadius: colors.radius }]}>
      <Text style={{ fontSize: 20 }}>📲</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Install HOLTO</Text>
        <Text style={styles.body}>
          {iosHint
            ? "Tap Share → Add to Home Screen for instant access and travel alerts."
            : "Add it to your home screen for one-tap access and disruption alerts."}
        </Text>
      </View>
      {!iosHint ? (
        <Pressable onPress={install} style={[styles.btn, { backgroundColor: colors.gold }]}>
          <Text style={styles.btnText}>Install</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={dismiss} hitSlop={10} style={{ padding: 2 }}>
        <Icon name="x" size={18} color="rgba(255,255,255,0.6)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 14 },
  title: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  body: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  btnText: { fontFamily: "Inter_700Bold", fontSize: 13, color: "#0A2E38" },
});
