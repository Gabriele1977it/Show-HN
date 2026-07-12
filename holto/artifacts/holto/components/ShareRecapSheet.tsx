import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Share, StyleSheet, Switch, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

export interface ShareTrip {
  id: number;
  title: string;
  isPublic?: boolean;
  publicSlug?: string | null;
  publicShowSpend?: boolean;
}

interface ShareState {
  isPublic: boolean;
  slug: string | null;
  showSpend: boolean;
}

// Where public recap pages live (the web app), so links work when shared from
// a phone too. Prefers the current web origin, then a configured base, then the
// production default used by the PWA share-card injector.
function webBase(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return process.env.EXPO_PUBLIC_WEB_URL ?? "https://app.holtotravel.com";
}

export function ShareRecapSheet({ trip, onClose }: { trip: ShareTrip | null; onClose: () => void }) {
  const colors = useColors();
  const qc = useQueryClient();
  const [state, setState] = useState<ShareState>({ isPublic: false, slug: null, showSpend: true });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (trip) {
      setState({ isPublic: !!trip.isPublic, slug: trip.publicSlug ?? null, showSpend: trip.publicShowSpend ?? true });
      setCopied(false);
    }
  }, [trip]);

  const link = state.slug ? `${webBase()}/t/${state.slug}` : null;

  const mutate = useMutation({
    mutationFn: (body: { isPublic?: boolean; showSpend?: boolean }) =>
      customFetch<ShareState>(`/api/trips/${trip!.id}/share`, { method: "POST", body: JSON.stringify(body), responseType: "json" }),
    onSuccess: (r) => {
      setState(r);
      void qc.invalidateQueries({ queryKey: ["trips"] });
    },
  });

  function togglePublic(next: boolean) {
    setState((s) => ({ ...s, isPublic: next }));
    mutate.mutate({ isPublic: next, showSpend: state.showSpend });
  }
  function toggleSpend(next: boolean) {
    setState((s) => ({ ...s, showSpend: next }));
    mutate.mutate({ isPublic: state.isPublic, showSpend: next });
  }

  async function share() {
    if (!link) return;
    const message = `My trip “${trip!.title}” on HOLTO`;
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? (navigator as unknown as { share?: (d: object) => Promise<void> }) : undefined;
      if (nav?.share) {
        try { await nav.share({ title: message, url: link }); return; } catch { /* cancelled */ }
      }
      await copy();
      return;
    }
    try { await Share.share({ message: `${message}\n${link}`, url: link }); } catch { /* cancelled */ }
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
    <Modal visible={!!trip} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Share your trip recap</Text>
            <Pressable onPress={onClose} hitSlop={10}><Icon name="x" size={22} color={colors.mutedForeground} /></Pressable>
          </View>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Turn “{trip?.title}” into a public page you can drop in your bio or stories — a clean recap of your journey, HOLTO-branded.
          </Text>

          <View style={[styles.row, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>Make it public</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Anyone with the link can view the recap.</Text>
            </View>
            <Switch value={state.isPublic} onValueChange={togglePublic} trackColor={{ true: colors.primary }} />
          </View>

          <View style={[styles.row, { borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>Show total spend</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Include the “£ spent” figure on the page.</Text>
            </View>
            <Switch value={state.showSpend} onValueChange={toggleSpend} disabled={!state.isPublic} trackColor={{ true: colors.primary }} />
          </View>

          {state.isPublic && link ? (
            <>
              <View style={[styles.linkBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.linkText, { color: colors.mutedForeground }]} numberOfLines={1}>{link}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable onPress={copy} style={[styles.ghostBtn, { borderColor: colors.border }]}>
                  <Icon name={copied ? "check" : "file-text"} size={16} color={copied ? "#2E7D52" : colors.foreground} />
                  <Text style={[styles.ghostBtnText, { color: copied ? "#2E7D52" : colors.foreground }]}>{copied ? "Copied" : "Copy link"}</Text>
                </Pressable>
                <Pressable onPress={share} style={[styles.solidBtn, { backgroundColor: colors.primary }]}>
                  <Icon name="share-2" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Share</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {mutate.isPending ? "Saving…" : "Turn on “Make it public” to get a shareable link."}
            </Text>
          )}
          {mutate.isPending ? <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} /> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  card: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: "Inter_700Bold", fontSize: 20 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, paddingVertical: 16 },
  rowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  rowSub: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginTop: 2 },
  linkBox: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 46, justifyContent: "center", marginTop: 16 },
  linkText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  ghostBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 48, borderRadius: 12, borderWidth: 1 },
  ghostBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  solidBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, height: 48, borderRadius: 12 },
  solidBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 16, textAlign: "center" },
});
