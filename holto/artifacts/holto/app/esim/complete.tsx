import { customFetch } from "@workspace/api-client-react";
import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EsimInstall, type EsimOrder } from "@/components/EsimInstall";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { trackAffiliateConversion } from "@/utils/affiliate";

export default function EsimCompleteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ session_id?: string }>();
  const sessionId = typeof params.session_id === "string" ? params.session_id : "";
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const fired = useRef(false);

  const fulfill = useMutation({
    mutationFn: (sid: string) => customFetch<{ order: EsimOrder }>("/api/esim/fulfill", { method: "POST", body: JSON.stringify({ sessionId: sid }), responseType: "json" }),
  });

  useEffect(() => {
    if (sessionId && !fired.current) {
      fired.current = true;
      fulfill.mutate(sessionId);
    }
  }, [sessionId]);

  const order = fulfill.data?.order;
  const errorMsg = (fulfill.error as { data?: { error?: string } })?.data?.error;

  // Report the completed eSIM sale to the affiliate program with the real order
  // number + amount charged. No-op on native; deduped per order (see helper).
  useEffect(() => {
    if (order?.id != null && order.amount != null) {
      trackAffiliateConversion(order.id, order.amount);
    }
  }, [order?.id, order?.amount]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: 60 }}>
      {fulfill.isPending || (!order && !fulfill.isError) ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>Confirming your payment and issuing your eSIM…</Text>
        </View>
      ) : fulfill.isError ? (
        <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 34 }}>⚠️</Text>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>We're finishing up</Text>
          <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
            {errorMsg ?? "Couldn't complete the eSIM just now."}
          </Text>
          <Pressable onPress={() => fulfill.mutate(sessionId)} style={[styles.retry, { backgroundColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Try again</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/esims" as never)} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Go to My eSIMs</Text>
          </Pressable>
        </View>
      ) : order ? (
        <>
          <View style={styles.header}>
            <Text style={{ fontSize: 34 }}>✅</Text>
            <Text style={[styles.h1, { color: colors.foreground }]}>You're all set</Text>
            <Text style={[styles.h1sub, { color: colors.mutedForeground }]}>Your eSIM is ready — install it before you fly.</Text>
          </View>
          <EsimInstall order={order} />
          <Pressable onPress={() => router.replace("/esims" as never)} style={[styles.myEsims, { borderColor: colors.border }]}>
            <Icon name="wifi" size={16} color={colors.primary} />
            <Text style={[styles.myEsimsText, { color: colors.foreground }]}>View in My eSIMs</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 16 },
  centerText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", maxWidth: 280 },
  header: { alignItems: "center", gap: 6, marginBottom: 22 },
  h1: { fontFamily: "Inter_700Bold", fontSize: 24, marginTop: 6 },
  h1sub: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  errorCard: { alignItems: "center", borderWidth: 1, padding: 28, marginTop: 30, gap: 10 },
  errorTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  errorSub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  retry: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  myEsims: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 13, marginTop: 20 },
  myEsimsText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
});
