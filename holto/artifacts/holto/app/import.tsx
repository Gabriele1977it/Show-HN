import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { bookingUploadSupported, pickBookingFile } from "@/utils/pickBookingFile";

interface ParsedTrip {
  id: number;
  title: string;
  items?: unknown[];
}

// Receives content from the OS share sheet (Web Share Target → GET /import with
// title/text/url params) and also works as a plain "paste a booking" box. Funnels
// everything through the existing /api/trips/parse AI parser — no new supplier.
export default function ImportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 24 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();
  const shared = useMemo(() => {
    const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
    return [pick(params.title), pick(params.text), pick(params.url)].map((s) => s.trim()).filter(Boolean).join("\n");
  }, [params.title, params.text, params.url]);

  const [text, setText] = useState(shared);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ParsedTrip | null>(null);

  const parse = useMutation({
    mutationFn: (t: string) => customFetch<ParsedTrip>("/api/trips/parse", { method: "POST", body: JSON.stringify({ text: t }), responseType: "json" }),
    onSuccess: (trip) => {
      setDone(trip);
      void qc.invalidateQueries({ queryKey: ["trips"] });
      void qc.invalidateQueries({ queryKey: ["journey-next"] });
    },
    onError: (err: unknown) => {
      const body = (err as { data?: { error?: string } }).data;
      setError(body?.error ?? "Couldn't read that booking. Try pasting more of the confirmation, or add it manually.");
    },
  });

  const parseFile = useMutation({
    mutationFn: (f: { data: string; mimeType: string }) =>
      customFetch<ParsedTrip>("/api/trips/parse-file", { method: "POST", body: JSON.stringify(f), responseType: "json" }),
    onSuccess: (trip) => {
      setDone(trip);
      void qc.invalidateQueries({ queryKey: ["trips"] });
      void qc.invalidateQueries({ queryKey: ["journey-next"] });
    },
    onError: (err: unknown) => {
      const body = (err as { data?: { error?: string } }).data;
      setError(body?.error ?? "Couldn't read that file. Try a clearer copy, or paste the text instead.");
    },
  });

  async function upload() {
    setError(null);
    const file = await pickBookingFile();
    if (!file) return;
    parseFile.mutate({ data: file.data, mimeType: file.mimeType });
  }

  function submit() {
    if (text.trim().length < 15) {
      setError("Paste a bit more of the confirmation so HOLTO can read it.");
      return;
    }
    setError(null);
    parse.mutate(text);
  }

  if (done) {
    const count = Array.isArray(done.items) ? done.items.length : 0;
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad + 8 }]}>
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.successCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={[styles.successIcon, { backgroundColor: "#2E7D5220" }]}>
            <Icon name="check-circle" size={28} color="#2E7D52" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Trip created</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Added “{done.title}”{count ? ` with ${count} item${count === 1 ? "" : "s"}` : ""} to your timeline.
          </Text>
          <Pressable onPress={() => router.replace("/trips")} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>View trip</Text>
          </Pressable>
          <Pressable onPress={() => { setDone(null); setText(""); }} style={{ paddingVertical: 12 }}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_500Medium", fontSize: 14 }}>Add another</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Add from a booking</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Paste a confirmation — or share one straight into HOLTO from your email app — and it builds your trip: flights, hotels and trains, with times and references.
        </Text>
      </Animated.View>

      {shared ? (
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={[styles.sharedNote, { backgroundColor: colors.primary + "14", borderRadius: colors.radius }]}>
          <Icon name="share-2" size={14} color={colors.primary} />
          <Text style={[styles.sharedNoteText, { color: colors.primary }]}>Shared from another app — check it below and build your trip.</Text>
        </Animated.View>
      ) : null}

      {bookingUploadSupported ? (
        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={{ marginTop: 16 }}>
          <Pressable
            onPress={upload}
            disabled={parseFile.isPending}
            style={[styles.uploadBtn, colors.shadow, { backgroundColor: colors.card, borderColor: colors.primary, borderRadius: colors.radius, opacity: parseFile.isPending ? 0.7 : 1 }]}
          >
            {parseFile.isPending ? (
              <>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.uploadText, { color: colors.primary }]}>Reading your booking…</Text>
              </>
            ) : (
              <>
                <Icon name="file-text" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.uploadText, { color: colors.foreground }]}>Upload a booking PDF</Text>
                  <Text style={[styles.uploadSub, { color: colors.mutedForeground }]}>Or a photo/screenshot — HOLTO reads it for you</Text>
                </View>
                <Icon name="chevron-right" size={18} color={colors.mutedForeground} />
              </>
            )}
          </Pressable>
          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.mutedForeground }]}>or paste the text</Text>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginTop: bookingUploadSupported ? 0 : 16 }}>
        <TextInput
          value={text}
          onChangeText={(t) => { setText(t); if (error) setError(null); }}
          placeholder={"Paste your booking confirmation here…\n\ne.g. \"Your flight BA503 from London Heathrow (LHR) to Lisbon (LIS) on 15 Aug at 14:30. Booking ref XZ12AB.\""}
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
          style={[styles.area, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
        />
        {error ? <Text style={[styles.err, { color: colors.destructive }]}>{error}</Text> : null}

        <Pressable onPress={submit} disabled={parse.isPending} style={[styles.primaryBtn, colors.shadow, { backgroundColor: colors.primary, opacity: parse.isPending ? 0.75 : 1, marginTop: 14 }]}>
          {parse.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : (
            <>
              <Text style={{ fontSize: 15 }}>✨</Text>
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Build my trip</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace("/trips")} style={{ alignItems: "center", paddingVertical: 14 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 14 }}>or add a trip manually</Text>
        </Pressable>
      </Animated.View>

      <Text style={[styles.tip, { color: colors.mutedForeground }]}>
        Tip: on your phone, open a booking email, tap Share, and choose HOLTO — it lands right here.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  h1: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.4 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, marginTop: 6 },
  sharedNote: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginTop: 16 },
  sharedNoteText: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, padding: 16 },
  uploadText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  uploadSub: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16, marginTop: 2 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, marginBottom: 2 },
  orLine: { flex: 1, height: 1 },
  orText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  area: { borderWidth: 1, minHeight: 200, padding: 14, fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 21 },
  err: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 10 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 12 },
  primaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  tip: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 22 },
  successCard: { alignItems: "center", borderWidth: 1, padding: 28, marginHorizontal: 20, gap: 8 },
  successIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  successTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  successSub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 10 },
});
