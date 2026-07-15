import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";
import { ESSENTIALS_LIST, findEssentials, type CountryEssentials } from "@/constants/countryEssentials";

interface VisaRequirement {
  category: string;
  allowedDays: number | null;
  label: string;
  detail: string;
  tone: "good" | "warn" | "bad";
}
interface OfficialLink { label: string; url: string }
interface VisaResponse {
  from: string;
  to: string;
  requirement: VisaRequirement | null;
  official: OfficialLink[];
  disclaimer: string;
  source: string;
}

const TONE: Record<string, { color: string; emoji: string }> = {
  good: { color: "#2E7D52", emoji: "✅" },
  warn: { color: "#C9A24B", emoji: "📝" },
  bad: { color: "#C0392B", emoji: "🛂" },
};

function CountryPicker({
  visible, title, onSelect, onClose,
}: { visible: boolean; title: string; onSelect: (c: CountryEssentials) => void; onClose: () => void }) {
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
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <View style={[styles.searchWrap, { borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.mutedForeground} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search a country" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} autoCorrect={false} />
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

export default function VisaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const [passport, setPassport] = useState<CountryEssentials>(() => findEssentials("GB") ?? ESSENTIALS_LIST[0]);
  const [dest, setDest] = useState<CountryEssentials | null>(null);
  const [picking, setPicking] = useState<null | "passport" | "dest">(null);

  const { data, isFetching, isError } = useQuery<VisaResponse>({
    queryKey: ["visa", passport.code, dest?.code],
    queryFn: () => customFetch<VisaResponse>(`/api/visa?from=${passport.code}&to=${dest!.code}&name=${encodeURIComponent(dest!.name)}`, { responseType: "json" }),
    enabled: !!dest,
    retry: false,
  });

  const req = data?.requirement;
  const tone = req ? TONE[req.tone] ?? TONE.warn : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad + 8, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Visa & entry</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Quick guidance on whether you need a visa — then confirm with the official source before you book.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.pickRow}>
        <Pressable onPress={() => setPicking("passport")} style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>Passport</Text>
          <Text style={[styles.pickCity, { color: colors.foreground }]} numberOfLines={1}>{passport.flag} {passport.name}</Text>
        </Pressable>
        <View style={[styles.arrow, { backgroundColor: colors.muted }]}><Icon name="chevron-right" size={16} color={colors.mutedForeground} /></View>
        <Pressable onPress={() => setPicking("dest")} style={[styles.pickBtn, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>Destination</Text>
          <Text style={[styles.pickCity, { color: dest ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>{dest ? `${dest.flag} ${dest.name}` : "Choose"}</Text>
        </Pressable>
      </Animated.View>

      {isFetching ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : null}

      {data && !isFetching ? (
        <Animated.View entering={FadeInDown.duration(360)} style={{ marginTop: 20 }}>
          {req && tone ? (
            <View style={[styles.resultCard, colors.shadow, { backgroundColor: colors.card, borderColor: tone.color, borderRadius: colors.radius }]}>
              <Text style={{ fontSize: 30 }}>{tone.emoji}</Text>
              <Text style={[styles.resultLabel, { color: tone.color }]}>{req.label}</Text>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>
                {passport.name} passport → {dest?.name}
              </Text>
              <Text style={[styles.resultDetail, { color: colors.mutedForeground }]}>{req.detail}</Text>
            </View>
          ) : (
            <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Text style={{ fontSize: 30 }}>🛂</Text>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>Check the official source</Text>
              <Text style={[styles.resultDetail, { color: colors.mutedForeground }]}>
                We couldn't load quick guidance for this route right now — use the official links below for the definitive answer.
              </Text>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OFFICIAL SOURCES</Text>
          {data.official.map((l) => (
            <Pressable key={l.url} onPress={() => openUrl(l.url)} style={[styles.linkRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Icon name="globe" size={16} color={colors.primary} />
              <Text style={[styles.linkText, { color: colors.foreground }]}>{l.label}</Text>
              <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          ))}

          <View style={[styles.disclaimer, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>⚠️ {data.disclaimer}</Text>
          </View>
        </Animated.View>
      ) : null}

      {isError && !isFetching ? (
        <Text style={[styles.err, { color: colors.destructive }]}>Couldn't check that route. Please try again.</Text>
      ) : null}

      <CountryPicker
        visible={picking !== null}
        title={picking === "passport" ? "Your passport" : "Where are you going?"}
        onSelect={(c) => (picking === "passport" ? setPassport(c) : setDest(c))}
        onClose={() => setPicking(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20 },
  pickBtn: { flex: 1, borderWidth: 1, padding: 14 },
  pickLabel: { fontFamily: "Inter_500Medium", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  pickCity: { fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 3 },
  arrow: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  resultCard: { alignItems: "center", borderWidth: 1.5, padding: 22, gap: 6 },
  resultLabel: { fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 2 },
  resultTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, textAlign: "center", marginTop: 2 },
  resultDetail: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 2 },
  sectionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 0.8, marginTop: 22, marginBottom: 10 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 8 },
  linkText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  disclaimer: { padding: 14, marginTop: 12 },
  disclaimerText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  err: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 20 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  cityRowLabel: { fontFamily: "Inter_500Medium", fontSize: 15 },
});
