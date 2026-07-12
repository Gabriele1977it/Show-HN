import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateField } from "@/components/DateField";
import { useColors } from "@/hooks/useColors";

interface Win { start: string; end: string }
interface ShootResult {
  available: boolean;
  reason?: string;
  location?: string;
  date?: string;
  polar?: boolean;
  sunrise?: string | null;
  sunset?: string | null;
  goldenMorning?: Win | null;
  goldenEvening?: Win | null;
  blueMorning?: Win | null;
  blueEvening?: Win | null;
  tzNote?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ShootTimesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ location?: string; date?: string }>();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const initialLocation = typeof params.location === "string" ? params.location : "";
  const initialDate = typeof params.date === "string" && ISO_DATE.test(params.date) ? params.date : "";

  const [location, setLocation] = useState(initialLocation);
  const [date, setDate] = useState(initialDate);
  const [error, setError] = useState<string | null>(null);
  // The submitted query (keyed for react-query). Auto-runs when deep-linked with a location.
  const [q, setQ] = useState<{ location: string; date: string } | null>(
    initialLocation ? { location: initialLocation, date: initialDate } : null,
  );

  const { data, isFetching, isError } = useQuery<ShootResult>({
    queryKey: ["shoot-times", q?.location, q?.date],
    queryFn: () =>
      customFetch<ShootResult>(
        `/api/shoot-times?location=${encodeURIComponent(q!.location)}${q!.date ? `&date=${q!.date}` : ""}`,
        { responseType: "json" },
      ),
    enabled: !!q,
    retry: false,
  });

  function run() {
    if (!location.trim()) return setError("Enter a place — a city or a landmark.");
    if (date && !ISO_DATE.test(date)) return setError("Date must be YYYY-MM-DD.");
    setError(null);
    setQ({ location: location.trim(), date });
  }

  const cards = useMemo(() => {
    if (!data?.available) return [];
    const list: { key: string; emoji: string; label: string; win?: Win | null; time?: string | null; hero?: boolean }[] = [
      { key: "blueM", emoji: "🌌", label: "Blue hour · dawn", win: data.blueMorning },
      { key: "sunrise", emoji: "🌅", label: "Sunrise", time: data.sunrise },
      { key: "goldenM", emoji: "🌟", label: "Golden hour · morning", win: data.goldenMorning, hero: true },
      { key: "goldenE", emoji: "🌟", label: "Golden hour · evening", win: data.goldenEvening, hero: true },
      { key: "sunset", emoji: "🌇", label: "Sunset", time: data.sunset },
      { key: "blueE", emoji: "🌌", label: "Blue hour · dusk", win: data.blueEvening },
    ];
    return list.filter((c) => c.win || c.time);
  }, [data]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Best light</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Golden hour and blue hour for any place and date — so you're set up before the light is perfect.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ marginTop: 18, gap: 8 }}>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Place (e.g. Lisbon, or Sagrada Familia)"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          onSubmitEditing={run}
          returnKeyType="search"
        />
        <DateField value={date} onChange={setDate} mode="date" placeholder="Date (defaults to today)" />
        {error ? <Text style={[styles.err, { color: colors.destructive }]}>{error}</Text> : null}
        <Pressable onPress={run} disabled={isFetching} style={[styles.cta, { backgroundColor: colors.primary, opacity: isFetching ? 0.75 : 1 }]}>
          {isFetching ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Find best light</Text>}
        </Pressable>
      </Animated.View>

      {isError ? (
        <Text style={[styles.note, { color: colors.destructive }]}>Couldn't find that place. Try a city or landmark name.</Text>
      ) : null}

      {data && !data.available ? (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Best-light lookup needs location search, which isn't switched on yet. Add a free Mapbox token (MAPBOX_TOKEN) and this lights up.
          </Text>
        </View>
      ) : null}

      {data?.available && data.polar ? (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.locHeading, { color: colors.foreground }]}>{data.location}</Text>
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Around this date the sun doesn't cross the horizon here — think endless soft light (midnight sun) or polar twilight rather than a single golden hour.
          </Text>
        </View>
      ) : null}

      {data?.available && !data.polar && cards.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginTop: 20 }}>
          <Text style={[styles.locHeading, { color: colors.foreground }]}>{data.location}</Text>
          {cards.map((c, i) => (
            <Animated.View
              key={c.key}
              entering={FadeInDown.delay(100 + i * 40).duration(360)}
              style={[
                styles.card,
                colors.shadow,
                {
                  backgroundColor: colors.card,
                  borderColor: c.hero ? colors.gold : colors.border,
                  borderRadius: colors.radius,
                  borderWidth: c.hero ? 1.5 : 1,
                },
              ]}
            >
              <Text style={styles.cardEmoji}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardLabel, { color: colors.foreground }]}>{c.label}</Text>
                {c.hero ? <Text style={[styles.heroTag, { color: colors.accent }]}>Best light for photos & video</Text> : null}
              </View>
              <Text style={[styles.cardTime, { color: c.hero ? colors.accent : colors.foreground }]}>
                {c.win ? `${c.win.start}–${c.win.end}` : c.time}
              </Text>
            </Animated.View>
          ))}
          {data.tzNote ? <Text style={[styles.note, { color: colors.mutedForeground }]}>{data.tzNote}</Text> : null}
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48, fontFamily: "Inter_500Medium", fontSize: 15, justifyContent: "center" },
  err: { fontFamily: "Inter_500Medium", fontSize: 13 },
  cta: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 6 },
  ctaText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  locHeading: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, marginBottom: 10 },
  cardEmoji: { fontSize: 22 },
  cardLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  heroTag: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  cardTime: { fontFamily: "Inter_700Bold", fontSize: 16 },
  infoCard: { borderWidth: 1, padding: 18, marginTop: 20 },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 14 },
});
