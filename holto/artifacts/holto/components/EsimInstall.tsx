import React, { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

export interface EsimOrder {
  id: number;
  country: string;
  packageTitle: string;
  dataLabel: string | null;
  days: number | null;
  status: string;
  iccid: string | null;
  qrCodeUrl: string | null;
  lpa: string | null;
}

// Renders the "install your eSIM" panel: the QR to scan plus the manual
// activation details, and clear step-by-step instructions. Used on both the
// post-purchase screen and the "My eSIMs" detail.
export function EsimInstall({ order }: { order: EsimOrder }) {
  const colors = useColors();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(label);
        setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
      } catch {
        /* clipboard blocked */
      }
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={{ fontSize: 22 }}>📶</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{order.dataLabel ?? order.packageTitle}{order.days ? ` · ${order.days} days` : ""}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{order.country} eSIM · ready to install</Text>
        </View>
      </View>

      {order.qrCodeUrl ? (
        <View style={[styles.qrCard, { backgroundColor: "#fff", borderColor: colors.border, borderRadius: colors.radius }]}>
          <Image source={{ uri: order.qrCodeUrl }} style={styles.qr} resizeMode="contain" accessibilityLabel="eSIM QR code" />
          <Text style={styles.qrHint}>Scan with the device you'll travel with</Text>
        </View>
      ) : null}

      <View style={[styles.steps, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.stepsTitle, { color: colors.foreground }]}>How to install</Text>
        {[
          "Open Settings → Mobile/Cellular → Add eSIM.",
          "Choose “Use QR Code” and scan the code above (or enter the details below by hand).",
          "Label the plan, then turn on Data Roaming for this eSIM once you land.",
        ].map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={[styles.stepNum, { color: colors.primary }]}>{i + 1}</Text>
            <Text style={[styles.stepText, { color: colors.foreground }]}>{s}</Text>
          </View>
        ))}
      </View>

      {(order.lpa || order.iccid) ? (
        <View style={[styles.manual, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.manualTitle, { color: colors.mutedForeground }]}>MANUAL INSTALL</Text>
          {order.lpa ? (
            <Pressable onPress={() => copy("lpa", order.lpa!)} style={styles.copyRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.manualLabel, { color: colors.mutedForeground }]}>Activation code</Text>
                <Text style={[styles.manualValue, { color: colors.foreground }]} numberOfLines={2}>{order.lpa}</Text>
              </View>
              {copied === "lpa" ? <Icon name="check" size={16} color="#2E7D52" /> : <Text style={[styles.copyLabel, { color: colors.primary }]}>Copy</Text>}
            </Pressable>
          ) : null}
          {order.iccid ? (
            <Pressable onPress={() => copy("iccid", order.iccid!)} style={[styles.copyRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.manualLabel, { color: colors.mutedForeground }]}>ICCID</Text>
                <Text style={[styles.manualValue, { color: colors.foreground }]}>{order.iccid}</Text>
              </View>
              {copied === "iccid" ? <Icon name="check" size={16} color="#2E7D52" /> : <Text style={[styles.copyLabel, { color: colors.primary }]}>Copy</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
        Tip: install before you fly (over Wi-Fi), but only switch it on when you arrive. Powered by Airalo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, padding: 16 },
  title: { fontFamily: "Inter_700Bold", fontSize: 16 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  qrCard: { alignItems: "center", borderWidth: 1, padding: 20, gap: 10 },
  qr: { width: 220, height: 220 },
  qrHint: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#334155" },
  steps: { borderWidth: 1, padding: 16, gap: 12 },
  stepsTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 2 },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNum: { fontFamily: "Inter_700Bold", fontSize: 15, width: 16 },
  stepText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, flex: 1 },
  manual: { borderWidth: 1, padding: 16 },
  manualTitle: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.6, marginBottom: 10 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  manualLabel: { fontFamily: "Inter_500Medium", fontSize: 11 },
  manualValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginTop: 2 },
  copyLabel: { fontFamily: "Inter_700Bold", fontSize: 13 },
  footnote: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
});
