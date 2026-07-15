import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";
import { track } from "@/utils/analytics";
import { ESSENTIALS_LIST, type CountryEssentials } from "@/constants/countryEssentials";

interface EsimPackage {
  id: string;
  operator: string;
  title: string;
  data: string;
  days: number | null;
  price: number | null;
  currency: string;
}

function priceLabel(price: number | null, currency: string): string | null {
  if (price == null) return null;
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const suffix = sym ? "" : ` ${currency}`;
  return `${sym}${price.toFixed(2)}${suffix}`;
}

// Country picker sheet — pick any destination we carry essentials for.
function CountryPicker({
  visible, onSelect, onClose,
}: { visible: boolean; onSelect: (c: CountryEssentials) => void; onClose: () => void }) {
  const colors = useColors();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...ESSENTIALS_LIST].sort((a, b) => a.name.localeCompare(b.name));
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Where are you going?</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <View style={[styles.searchWrap, { borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a country"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCorrect={false}
            />
          </View>
          <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
            {filtered.map((c) => (
              <Pressable key={c.code} onPress={() => { onSelect(c); onClose(); setQuery(""); }} style={[styles.cityRow, { borderBottomColor: colors.border }]}>
                <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                <Text style={[styles.cityRowLabel, { color: colors.foreground }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function EsimShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const [country, setCountry] = useState<CountryEssentials | null>(null);
  const [picking, setPicking] = useState(false);

  const status = useQuery<{ configured: boolean; canBuy: boolean }>({
    queryKey: ["esim-status"],
    queryFn: () => customFetch<{ configured: boolean; canBuy: boolean }>("/api/esim/status", { responseType: "json" }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const configured = status.data?.configured ?? false;
  const canBuy = status.data?.canBuy ?? false;

  const packages = useQuery<{ configured: boolean; canBuy: boolean; packages: EsimPackage[] }>({
    queryKey: ["esim-shop", country?.code],
    queryFn: () => customFetch(`/api/esim/packages?country=${country!.code}`, { responseType: "json" }),
    enabled: !!country && configured,
    retry: false,
  });

  const buy = useMutation({
    mutationFn: (packageId: string) =>
      customFetch<{ url: string }>("/api/esim/checkout", { method: "POST", body: JSON.stringify({ packageId, country: country!.code }), responseType: "json" }),
    onSuccess: (r) => {
      track("esim_checkout_start");
      if (!r?.url) return;
      if (Platform.OS === "web" && typeof window !== "undefined") window.location.assign(r.url);
      else openUrl(r.url);
    },
  });

  const list = packages.data?.configured ? packages.data.packages : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>eSIM data plans</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Prepaid data for 190+ countries. Install before you fly, switch on when you land — no roaming bills.
        </Text>
      </Animated.View>

      <Pressable onPress={() => router.push("/esims" as never)} style={[styles.myLink, { borderColor: colors.border }]}>
        <Icon name="wifi" size={15} color={colors.primary} />
        <Text style={[styles.myLinkText, { color: colors.foreground }]}>My eSIMs</Text>
        <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>

      {status.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !configured ? (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={{ fontSize: 30 }}>📶</Text>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>Almost ready</Text>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            We're finishing onboarding our eSIM partner. Data plans will appear here very soon — check back shortly.
          </Text>
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setPicking(true)}
            style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>Destination</Text>
            <View style={styles.pickValueRow}>
              <Text style={[styles.pickValue, { color: country ? colors.foreground : colors.mutedForeground }]}>
                {country ? `${country.flag}  ${country.name}` : "Choose a country"}
              </Text>
              <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
          </Pressable>

          {country && packages.isFetching ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : null}

          {country && !packages.isFetching && list.length === 0 ? (
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                No plans found for {country.name} right now. Try another destination.
              </Text>
            </View>
          ) : null}

          {list.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(360)} style={[styles.plans, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {list.slice(0, 8).map((p, i) => {
                const label = priceLabel(p.price, p.currency);
                const loading = buy.isPending && buy.variables === p.id;
                return (
                  <View key={p.id} style={[styles.planRow, i > 0 ? { borderTopColor: colors.border, borderTopWidth: 1 } : null]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.planData, { color: colors.foreground }]}>{p.data}{p.days ? ` · ${p.days} days` : ""}</Text>
                      <Text style={[styles.planOp, { color: colors.mutedForeground }]}>{p.operator}</Text>
                    </View>
                    {canBuy && p.price != null ? (
                      <Pressable onPress={() => buy.mutate(p.id)} disabled={buy.isPending} style={[styles.buyBtn, { backgroundColor: colors.primary, opacity: buy.isPending && !loading ? 0.5 : 1 }]}>
                        {loading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Text style={[styles.buyText, { color: colors.primaryForeground }]}>{label}</Text>}
                      </Pressable>
                    ) : label ? (
                      <Text style={[styles.planPrice, { color: colors.primary }]}>{label}</Text>
                    ) : null}
                  </View>
                );
              })}
            </Animated.View>
          ) : null}

          {buy.isError ? (
            <Text style={[styles.err, { color: colors.destructive }]}>
              {(buy.error as { data?: { error?: string } })?.data?.error ?? "Couldn't start that purchase. Please try again."}
            </Text>
          ) : null}

          {list.length > 0 ? (
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              Powered by Airalo. You'll get a QR code to install right after payment — do it over Wi-Fi before you fly, and switch it on when you land.
            </Text>
          ) : null}
        </>
      )}

      <CountryPicker visible={picking} onSelect={setCountry} onClose={() => setPicking(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  myLink: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, marginTop: 16 },
  myLinkText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  pickBtn: { borderWidth: 1, padding: 16, marginTop: 18 },
  pickLabel: { fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  pickValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  pickValue: { fontFamily: "Inter_700Bold", fontSize: 18, flex: 1 },
  plans: { borderWidth: 1, padding: 16, marginTop: 18 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  planData: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  planOp: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  planPrice: { fontFamily: "Inter_700Bold", fontSize: 16 },
  buyBtn: { minWidth: 72, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  buyText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 14 },
  err: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 14 },
  infoCard: { alignItems: "center", borderWidth: 1, padding: 24, marginTop: 20, gap: 8 },
  infoTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  cityRowLabel: { fontFamily: "Inter_500Medium", fontSize: 15 },
});
