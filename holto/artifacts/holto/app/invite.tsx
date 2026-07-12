import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { HoltoLogo } from "@/components/HoltoLogo";
import { useColors } from "@/hooks/useColors";

interface ReferralResp {
  code: string;
  invited: number;
}

function webBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.EXPO_PUBLIC_WEB_URL ?? "https://app.holtotravel.com";
}

export default function InviteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<ReferralResp>({
    queryKey: ["referral"],
    queryFn: () => customFetch<ReferralResp>("/api/referral", { responseType: "json" }),
    retry: false,
  });

  const link = data ? `${webBase()}/?ref=${data.code}` : "";
  const message = "I use HOLTO as my honest travel companion — flight alerts, disruption help and a whole toolkit. Join me:";

  async function share() {
    if (!link) return;
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? (navigator as unknown as { share?: (d: object) => Promise<void> }) : undefined;
      if (nav?.share) {
        try { await nav.share({ title: "HOLTO", text: message, url: link }); return; } catch { /* cancelled */ }
      }
      await copy();
      return;
    }
    try { await Share.share({ message: `${message}\n${link}` }); } catch { /* cancelled */ }
  }
  async function copy() {
    if (!link) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch { /* blocked */ }
    } else {
      try { await Share.share({ message: link }); } catch { /* cancelled */ }
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: 40 }}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Invite friends</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Travel is better together. Share HOLTO with fellow travellers — your link tracks everyone who joins.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)}>
        <View style={[styles.hero, colors.shadow, { backgroundColor: colors.midnight, borderRadius: colors.radius }]}>
          <View style={{ alignItems: "flex-start" }}><HoltoLogo size="small" inverted /></View>
          <Text style={styles.heroCount}>{isLoading ? "…" : data?.invited ?? 0}</Text>
          <Text style={styles.heroCountLabel}>{(data?.invited ?? 0) === 1 ? "friend joined so far" : "friends joined so far"}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[styles.linkCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.linkLabel, { color: colors.mutedForeground }]}>YOUR INVITE LINK</Text>
        <Text style={[styles.link, { color: colors.foreground }]} numberOfLines={1}>{isLoading ? "Loading…" : link}</Text>
        <View style={styles.actions}>
          <Pressable onPress={copy} disabled={!link} style={[styles.ghostBtn, { borderColor: colors.border }]}>
            <Icon name={copied ? "check" : "file-text"} size={16} color={copied ? "#2E7D52" : colors.foreground} />
            <Text style={[styles.ghostBtnText, { color: copied ? "#2E7D52" : colors.foreground }]}>{copied ? "Copied" : "Copy link"}</Text>
          </Pressable>
          <Pressable onPress={share} disabled={!link} style={[styles.solidBtn, { backgroundColor: colors.primary }]}>
            <Icon name="share-2" size={16} color={colors.primaryForeground} />
            <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Share</Text>
          </Pressable>
        </View>
      </Animated.View>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Thanks for spreading the word. We look after our top inviters — keep sharing and we'll be in touch. 💙
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  hero: { padding: 22, marginTop: 18, alignItems: "center" },
  heroCount: { fontFamily: "Inter_700Bold", fontSize: 52, color: "#fff", letterSpacing: -1, marginTop: 14 },
  heroCountLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  linkCard: { borderWidth: 1, padding: 18, marginTop: 14 },
  linkLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8 },
  link: { fontFamily: "Inter_500Medium", fontSize: 14, marginTop: 8 },
  actions: { flexDirection: "row", gap: 10, marginTop: 16 },
  ghostBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 48, borderRadius: 12, borderWidth: 1 },
  ghostBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  solidBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 48, borderRadius: 12 },
  solidBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 20 },
});
