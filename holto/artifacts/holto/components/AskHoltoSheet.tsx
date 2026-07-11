import { Icon } from "@/components/Icon";
import * as Location from "expo-location";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { customFetch } from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_H * 0.78;

interface Place {
  name: string;
  vicinity: string;
  rating?: number | null;
  openNow?: boolean | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function openDirections(lat: number, lng: number, name: string) {
  const label = encodeURIComponent(name);
  if (Platform.OS === "ios") {
    Linking.openURL(`maps://maps.apple.com/?q=${label}&ll=${lat},${lng}&dirflg=w`);
  } else if (Platform.OS === "android") {
    Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}(${label})`);
  } else {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  }
}

function PlaceRow({
  place,
  userLat,
  userLng,
  colors,
  index,
}: {
  place: Place;
  userLat: number | null;
  userLng: number | null;
  colors: ReturnType<typeof useColors>;
  index: number;
}) {
  const distKm =
    userLat != null && userLng != null && place.lat != null && place.lng != null
      ? haversineKm(userLat, userLng, place.lat, place.lng)
      : null;

  const hasCoords = place.lat != null && place.lng != null;

  return (
    <View style={[styles.placeRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.placeName, { color: colors.foreground }]} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={[styles.placeMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {[
            place.vicinity,
            distKm != null ? formatDist(distKm) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {place.rating != null && (
          <View style={styles.ratingRow}>
            <Icon name="star" size={10} color="#C9A24B" />
            <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
              {place.rating.toFixed(1)}
            </Text>
            {place.openNow != null && (
              <Text
                style={[
                  styles.openText,
                  { color: place.openNow ? "#2E7D52" : colors.mutedForeground },
                ]}
              >
                · {place.openNow ? "Open" : "Closed"}
              </Text>
            )}
          </View>
        )}
        {place.rating == null && place.openNow != null && (
          <Text
            style={[
              styles.ratingText,
              { color: place.openNow ? "#2E7D52" : colors.mutedForeground },
            ]}
          >
            {place.openNow ? "Open now" : "Currently closed"}
          </Text>
        )}
      </View>

      {hasCoords && (
        <Pressable
          onPress={() => openDirections(place.lat!, place.lng!, place.name)}
          style={({ pressed }) => [
            styles.directionsBtn,
            { backgroundColor: colors.primary + "15", opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityLabel={`Directions to ${place.name}`}
          hitSlop={8}
        >
          <Icon name="navigation" size={13} color={colors.primary} />
          <Text style={[styles.directionsBtnText, { color: colors.primary }]}>Directions</Text>
        </Pressable>
      )}
    </View>
  );
}

const QUICK_PROMPTS = [
  "What's my next flight?",
  "How many days can I still spend in Portugal?",
  "What's on my next trip?",
  "Where can I eat nearby?",
  "Is there a pharmacy?",
  "What should I pack for Egypt?",
];

export default function AskHoltoSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleClose = () => {
    setQuestion("");
    setAnswer(null);
    setPlaces([]);
    setError(null);
    onClose();
  };

  const handleSend = async (q?: string) => {
    const finalQ = (q ?? question).trim();
    if (!finalQ || loading) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setPlaces([]);
    setQuestion(finalQ);

    let lat: number | null = null;
    let lng: number | null = null;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        setUserLat(lat);
        setUserLng(lng);
      }
    } catch {
      // proceed without location
    }

    try {
      const data = await customFetch<{ answer: string; places: Place[] }>("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: finalQ, lat, lng }),
      });
      setAnswer(data.answer);
      setPlaces(data.places ?? []);
    } catch (err: unknown) {
      const body = (err as { data?: { error?: string; requiresUpgrade?: boolean } }).data;
      if (body?.requiresUpgrade) {
        setError("Ask HOLTO is a premium feature. Upgrade to a Trip Pass or Holto Pro to use it.");
      } else {
        setError(body?.error ?? "HOLTO couldn't respond right now. Try again in a moment.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.kvWrapper, { pointerEvents: "box-none" }]}
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, height: SHEET_HEIGHT }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Ask HOLTO</Text>
              <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                Food, pharmacies, ATMs and more
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: colors.background }]}
            >
              <Icon name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!answer && !loading && !error && (
              <View style={styles.quickGrid}>
                {QUICK_PROMPTS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => handleSend(p)}
                    style={({ pressed }) => [
                      styles.quickChip,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.quickText, { color: colors.foreground }]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {loading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                  Finding options near you…
                </Text>
              </View>
            )}

            {error && (
              <View style={[styles.errorBox, { backgroundColor: "#C0392B0D" }]}>
                <Icon name="alert-circle" size={15} color="#C0392B" style={{ flexShrink: 0 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {answer && (
              <>
                <View
                  style={[
                    styles.questionBubble,
                    { backgroundColor: colors.primary + "18" },
                  ]}
                >
                  <Text style={[styles.questionText, { color: colors.foreground }]}>{question}</Text>
                </View>

                <View style={styles.answerRow}>
                  <View style={[styles.holtoAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.holtoAvatarText}>H</Text>
                  </View>
                  <Text style={[styles.answerText, { color: colors.foreground }]}>{answer}</Text>
                </View>

                {places.length > 0 && (
                  <View
                    style={[
                      styles.placesCard,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    {places.map((p, i) => (
                      <PlaceRow
                        key={`${p.name}-${i}`}
                        place={p}
                        userLat={userLat}
                        userLng={userLng}
                        colors={colors}
                        index={i}
                      />
                    ))}
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    setAnswer(null);
                    setPlaces([]);
                    setQuestion("");
                    setError(null);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  style={({ pressed }) => [styles.askAgainBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="rotate-ccw" size={13} color={colors.primary} />
                  <Text style={[styles.askAgainText, { color: colors.primary }]}>Ask something else</Text>
                </Pressable>
              </>
            )}
          </ScrollView>

          <View
            style={[
              styles.inputRow,
              { borderTopColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[
                styles.textInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Type a question…"
              placeholderTextColor={colors.mutedForeground}
              value={answer ? "" : question}
              onChangeText={setQuestion}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              editable={!loading}
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={loading || !question.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: loading || !question.trim() ? 0.35 : 1,
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="send" size={16} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  kvWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  sheetTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  quickChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  quickText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  loadingBox: { alignItems: "center", paddingVertical: 48, gap: 14 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#C0392B", lineHeight: 19 },
  questionBubble: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    alignSelf: "flex-end",
    maxWidth: "82%",
  },
  questionText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  answerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 18,
  },
  holtoAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  holtoAvatarText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  answerText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
  },
  placesCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  placeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  placeMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  ratingText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  openText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexShrink: 0,
  },
  directionsBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  askAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  askAgainText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  textInput: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
