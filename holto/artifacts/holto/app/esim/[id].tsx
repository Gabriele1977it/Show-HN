import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EsimInstall, type EsimOrder } from "@/components/EsimInstall";
import { useColors } from "@/hooks/useColors";

export default function EsimDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  const { data, isLoading, isError } = useQuery<{ order: EsimOrder }>({
    queryKey: ["esim-order", id],
    queryFn: () => customFetch<{ order: EsimOrder }>(`/api/esim/orders/${id}`, { responseType: "json" }),
    enabled: !!id,
    retry: false,
  });
  const order = data?.order;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: 60 }}>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError || !order ? (
        <View style={[styles.msg, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 30 }}>🔍</Text>
          <Text style={[styles.msgText, { color: colors.mutedForeground }]}>We couldn't find that eSIM.</Text>
        </View>
      ) : order.status !== "fulfilled" ? (
        <View style={[styles.msg, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 30 }}>{order.status === "failed" ? "⚠️" : "⏳"}</Text>
          <Text style={[styles.msgTitle, { color: colors.foreground }]}>{order.status === "failed" ? "Something went wrong" : "Still processing"}</Text>
          <Text style={[styles.msgText, { color: colors.mutedForeground }]}>
            {order.status === "failed"
              ? "Your payment went through but the eSIM couldn't be issued. Please contact support — we'll sort it or refund you."
              : "This eSIM is being issued. Check back in a moment."}
          </Text>
        </View>
      ) : (
        <EsimInstall order={order} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 60, alignItems: "center" },
  msg: { alignItems: "center", borderWidth: 1, padding: 28, marginTop: 20, gap: 10 },
  msgTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  msgText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
});
