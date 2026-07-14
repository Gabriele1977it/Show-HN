import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

interface Overview {
  counts: Record<string, number>;
  aiUsage?: { callsToday: number; callsLast30d: number; searchesToday: number; dailyCap: number | null };
  integrations: Record<string, boolean>;
  generatedAt: string;
}
interface AdminUser {
  id: number;
  email: string;
  name: string;
  tier: string;
  grantedTier: string | null;
  hasStripe: boolean;
  createdAt: string;
}

const COUNT_LABELS: Record<string, string> = {
  users: "Users",
  newUsersThisWeek: "New (7d)",
  trips: "Trips",
  monitoredFlightsActive: "Flights watched",
  disruptions: "Disruptions",
  claims: "Claims",
  expenses: "Expenses",
  pushTokens: "Push devices",
  loyaltyPrograms: "Loyalty cards",
  countryStays: "Country stays",
};
const INTEGRATION_LABELS: Record<string, string> = {
  geminiAI: "Gemini AI",
  openAI: "OpenAI",
  flights_airlabs: "Flights (AirLabs)",
  maps_mapbox: "Maps (Mapbox)",
  costOfLiving_zyla: "Cost of living (Zyla)",
  stripe: "Stripe",
  sessionSecret: "Session secret",
  ownerEmailsSet: "Owner emails",
  pushExpo: "Push (Expo)",
  email_resend: "Email (Resend)",
  awardwallet: "AwardWallet",
};
const TIER_OPTS = [
  { v: "free", label: "Free" },
  { v: "trip_pass", label: "Trip Pass" },
  { v: "pro", label: "Pro" },
];

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 24;

  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [newTier, setNewTier] = useState("pro");
  const [notice, setNotice] = useState<string | null>(null);

  const [cEmail, setCEmail] = useState("");
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [cYt, setCYt] = useState("");
  const [cIg, setCIg] = useState("");
  const [cNotice, setCNotice] = useState<string | null>(null);

  const overview = useQuery<Overview>({
    queryKey: ["admin-overview"],
    queryFn: () => customFetch<Overview>("/api/admin/overview", { responseType: "json" }),
    retry: false,
  });
  const usersQ = useQuery<{ users: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: () => customFetch<{ users: AdminUser[] }>("/api/admin/users", { responseType: "json" }),
    retry: false,
    enabled: !overview.isError,
  });
  const analyticsQ = useQuery<{ events: { event: string; total: number }[] }>({
    queryKey: ["admin-analytics"],
    queryFn: () => customFetch<{ events: { event: string; total: number }[] }>("/api/admin/analytics", { responseType: "json" }),
    retry: false,
    enabled: !overview.isError,
  });
  const creatorsQ = useQuery<{ creators: { id: number; email: string; code: string; name: string | null; signups: number }[] }>({
    queryKey: ["admin-creators"],
    queryFn: () => customFetch<{ creators: { id: number; email: string; code: string; name: string | null; signups: number }[] }>("/api/admin/creators", { responseType: "json" }),
    retry: false,
    enabled: !overview.isError,
  });

  const setTier = useMutation({
    mutationFn: (v: { id: number; tier: string }) =>
      customFetch(`/api/admin/users/${v.id}/tier`, { method: "PATCH", body: JSON.stringify({ tier: v.tier }), responseType: "json" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const addUser = useMutation({
    mutationFn: (body: object) => customFetch<{ created: boolean; tempPassword?: string; tier: string; user: { email: string } }>("/api/admin/users", { method: "POST", body: JSON.stringify(body), responseType: "json" }),
    onSuccess: (r) => {
      setEmail("");
      setName("");
      setNotice(
        r.created
          ? `Created ${r.user.email} on ${r.tier}.${r.tempPassword ? ` Temp password: ${r.tempPassword}` : ""}`
          : `Updated ${r.user.email} to ${r.tier}.`,
      );
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: () => setNotice("Couldn't add that user. Check the email and try again."),
  });

  const makeCreator = useMutation({
    mutationFn: (body: { id: number; code: string; name: string; youtube: string; instagram: string }) =>
      customFetch(`/api/admin/users/${body.id}/creator`, {
        method: "PATCH",
        body: JSON.stringify({ code: body.code, name: body.name || undefined, youtube: body.youtube || undefined, instagram: body.instagram || undefined }),
        responseType: "json",
      }),
    onSuccess: () => {
      setCNotice("Creator saved. Their signup link: app.holtotravel.com/?ref=" + cCode.trim().toUpperCase());
      setCEmail("");
      setCCode("");
      setCName("");
      setCYt("");
      setCIg("");
      void qc.invalidateQueries({ queryKey: ["admin-creators"] });
    },
    onError: () => setCNotice("Couldn't save. Check the email matches a user and the code is free (3–20 letters/numbers)."),
  });

  const seedTrips = useMutation({
    mutationFn: (id: number) => customFetch<{ trips: { title: string; url: string }[] }>(`/api/admin/users/${id}/demo-trips`, { method: "POST", responseType: "json" }),
    onSuccess: (r) => {
      const links = (r.trips ?? []).map((t) => `${t.title}: ${t.url}`).join("\n");
      setCNotice(`Demo trips ready:\n${links}`);
    },
    onError: () => setCNotice("Couldn't create demo trips. Try again."),
  });

  function submitCreator() {
    const user = usersQ.data?.users.find((u) => u.email.toLowerCase() === cEmail.trim().toLowerCase());
    if (!user) {
      setCNotice("No user found with that email. They need a HOLTO account first.");
      return;
    }
    if (!/^[A-Za-z0-9]{3,20}$/.test(cCode.trim())) {
      setCNotice("Code must be 3–20 letters or numbers (e.g. YORKSHIRE).");
      return;
    }
    setCNotice(null);
    makeCreator.mutate({ id: user.id, code: cCode.trim(), name: cName.trim(), youtube: cYt.trim(), instagram: cIg.trim() });
  }

  if (overview.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (overview.isError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 28 }]}>
        <Text style={{ fontSize: 34 }}>🔒</Text>
        <Text style={[styles.h2, { color: colors.foreground, marginTop: 12 }]}>Not available</Text>
        <Text style={[styles.muted, { color: colors.mutedForeground, textAlign: "center", marginTop: 6 }]}>
          This area is for the app owner only.
        </Text>
      </View>
    );
  }

  const users = usersQ.data?.users ?? [];
  const filtered = q.trim() ? users.filter((u) => (u.email + u.name).toLowerCase().includes(q.trim().toLowerCase())) : users;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingTop: topPad, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={[styles.h1, { color: colors.foreground }]}>Admin</Text>
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>Behind the scenes · onboard influencers to a tier.</Text>
      </Animated.View>

      {/* Stats */}
      <View style={styles.statGrid}>
        {Object.entries(COUNT_LABELS).map(([k, label]) => (
          <View key={k} style={[styles.statCard, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.data?.counts[k] ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* AI cost visibility */}
      {overview.data?.aiUsage ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>AI usage (token cost)</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={styles.aiRow}>
              <View style={styles.aiCell}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.data.aiUsage.callsToday}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>AI calls today</Text>
              </View>
              <View style={styles.aiCell}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.data.aiUsage.callsLast30d}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>AI calls · 30d</Text>
              </View>
              <View style={styles.aiCell}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{overview.data.aiUsage.searchesToday}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Searches today</Text>
              </View>
            </View>
            <Text style={[styles.muted, { color: colors.mutedForeground, marginTop: 10 }]}>
              {overview.data.aiUsage.dailyCap
                ? `Per-user daily cap: ${overview.data.aiUsage.dailyCap} (free tier). Set via AI_CALLS_PER_DAY.`
                : "No per-user daily cap set. Add AI_CALLS_PER_DAY to cap free-tier AI usage."}
            </Text>
          </View>
        </>
      ) : null}

      {/* Product analytics */}
      {analyticsQ.data?.events && analyticsQ.data.events.length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>Analytics · 30 days</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {analyticsQ.data.events.map((e, i) => (
              <View key={e.event} style={[styles.evtRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                <Text style={[styles.evtName, { color: colors.foreground }]}>{e.event}</Text>
                <Text style={[styles.evtCount, { color: colors.mutedForeground }]}>{e.total}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* Integration health */}
      <Text style={[styles.section, { color: colors.foreground }]}>Integrations</Text>
      <View style={styles.chipWrap}>
        {Object.entries(INTEGRATION_LABELS).map(([k, label]) => {
          const on = overview.data?.integrations[k];
          return (
            <View key={k} style={[styles.hChip, { backgroundColor: colors.card, borderColor: on ? "#2E7D52" : colors.border }]}>
              <View style={[styles.dot, { backgroundColor: on ? "#2E7D52" : colors.mutedForeground }]} />
              <Text style={[styles.hChipText, { color: colors.foreground }]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {/* Add / grant */}
      <Text style={[styles.section, { color: colors.foreground }]}>Onboard a user</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" keyboardType="email-address" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
        <TextInput value={name} onChangeText={setName} placeholder="Name (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
        <View style={[styles.tierRow, { marginTop: 10 }]}>
          {TIER_OPTS.map((t) => (
            <Pressable key={t.v} onPress={() => setNewTier(t.v)} style={[styles.tierChip, { backgroundColor: newTier === t.v ? colors.primary : colors.background, borderColor: newTier === t.v ? colors.primary : colors.border }]}>
              <Text style={[styles.tierChipText, { color: newTier === t.v ? colors.primaryForeground : colors.foreground }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => email.trim() && addUser.mutate({ email: email.trim(), name: name.trim() || undefined, tier: newTier })} disabled={addUser.isPending} style={[styles.solidBtn, { backgroundColor: colors.primary, marginTop: 12, opacity: addUser.isPending ? 0.7 : 1 }]}>
          {addUser.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Create / grant tier</Text>}
        </Pressable>
        {notice ? <Text style={[styles.notice, { color: colors.foreground, backgroundColor: colors.muted }]} selectable>{notice}</Text> : null}
      </View>

      {/* Creators */}
      <Text style={[styles.section, { color: colors.foreground }]}>Creators</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <TextInput value={cEmail} onChangeText={setCEmail} placeholder="Creator's account email" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" keyboardType="email-address" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
        <TextInput value={cCode} onChangeText={setCCode} placeholder="Vanity code (e.g. YORKSHIRE)" placeholderTextColor={colors.mutedForeground} autoCapitalize="characters" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
        <TextInput value={cName} onChangeText={setCName} placeholder="Display name (e.g. Yorkshire Lad Abroad)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
        <TextInput value={cYt} onChangeText={setCYt} placeholder="YouTube URL (optional)" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
        <TextInput value={cIg} onChangeText={setCIg} placeholder="Instagram URL (optional)" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 8 }]} />
        <Pressable onPress={submitCreator} disabled={makeCreator.isPending} style={[styles.solidBtn, { backgroundColor: colors.primary, marginTop: 12, opacity: makeCreator.isPending ? 0.7 : 1 }]}>
          {makeCreator.isPending ? <ActivityIndicator color={colors.primaryForeground} size="small" /> : <Text style={[styles.solidBtnText, { color: colors.primaryForeground }]}>Save creator</Text>}
        </Pressable>
        {cNotice ? <Text style={[styles.notice, { color: colors.foreground, backgroundColor: colors.muted }]} selectable>{cNotice}</Text> : null}
      </View>
      {creatorsQ.data?.creators.map((c) => (
        <View key={c.id} style={[styles.userRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userEmail, { color: colors.foreground }]}>{c.name ?? c.email} · {c.code}</Text>
            <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>{c.signups} signup{c.signups === 1 ? "" : "s"} via code</Text>
          </View>
          <Pressable onPress={() => seedTrips.mutate(c.id)} disabled={seedTrips.isPending} style={[styles.miniAction, { borderColor: colors.border }]}>
            <Text style={[styles.miniActionText, { color: colors.primary }]}>{seedTrips.isPending ? "…" : "Demo trips"}</Text>
          </Pressable>
        </View>
      ))}

      {/* Users */}
      <Text style={[styles.section, { color: colors.foreground }]}>Users ({users.length})</Text>
      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search users" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" style={[styles.searchInput, { color: colors.foreground }]} />
      </View>
      {filtered.map((u) => (
        <View key={u.id} style={[styles.userRow, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userEmail, { color: colors.foreground }]} numberOfLines={1}>{u.email}</Text>
            <Text style={[styles.userMeta, { color: colors.mutedForeground }]}>{u.name} · {u.tier}</Text>
          </View>
          <View style={styles.tierRow}>
            {TIER_OPTS.map((t) => {
              const active = (u.grantedTier ?? "free") === t.v || (t.v === "free" && !u.grantedTier);
              return (
                <Pressable key={t.v} onPress={() => setTier.mutate({ id: u.id, tier: t.v })} style={[styles.miniChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
                  <Text style={[styles.miniChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{t.label[0]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  h1: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.3 },
  h2: { fontFamily: "Inter_700Bold", fontSize: 18 },
  muted: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, marginTop: 4 },
  section: { fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 24, marginBottom: 10 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  statCard: { width: "31%", borderWidth: 1, padding: 12, minWidth: 96, flexGrow: 1 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  miniAction: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  miniActionText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  evtRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  evtName: { fontFamily: "Inter_500Medium", fontSize: 14 },
  evtCount: { fontFamily: "Inter_700Bold", fontSize: 14 },
  aiRow: { flexDirection: "row", justifyContent: "space-between" },
  aiCell: { flex: 1, alignItems: "flex-start" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  hChipText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  card: { borderWidth: 1, padding: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 46, fontFamily: "Inter_500Medium", fontSize: 15 },
  tierRow: { flexDirection: "row", gap: 8 },
  tierChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  tierChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  solidBtn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  solidBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  notice: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 12, padding: 12, borderRadius: 10, overflow: "hidden" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, height: "100%" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  userEmail: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  userMeta: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  miniChip: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  miniChipText: { fontFamily: "Inter_700Bold", fontSize: 13 },
});
