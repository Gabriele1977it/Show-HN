import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { openUrl } from "@/utils/openUrl";

interface Status {
  configured: boolean;
  connectUrl: string | null;
  linked: boolean;
  syncedAt: string | null;
}

function syncedLabel(iso: string | null): string {
  if (!iso) return "";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * AwardWallet auto-import card. Renders nothing until the server reports the
 * integration is configured (AWARDWALLET_API_KEY set), so it stays invisible
 * until the owner turns it on. Lets a user connect their AwardWallet and pull
 * their loyalty balances into the wallet in one tap.
 */
export function AwardWalletCard({ onSynced }: { onSynced: () => void }) {
  const colors = useColors();
  const [note, setNote] = useState<string | null>(null);

  const { data: status, refetch } = useQuery<Status>({
    queryKey: ["awardwallet-status"],
    queryFn: () => customFetch<Status>("/api/awardwallet/status", { responseType: "json" }),
    retry: false,
  });

  const sync = useMutation({
    mutationFn: () => customFetch<{ imported: number; updated: number; total: number }>("/api/awardwallet/sync", { method: "POST", responseType: "json" }),
    onSuccess: (r) => {
      const changed = (r?.imported ?? 0) + (r?.updated ?? 0);
      setNote(changed > 0 ? `Synced ${changed} programme${changed === 1 ? "" : "s"} from AwardWallet.` : "You're up to date — nothing new to import.");
      onSynced();
      refetch();
    },
    onError: (e) => setNote((e as Error).message ?? "Couldn't sync just now. Try again in a moment."),
  });

  if (!status?.configured) return null;

  const connect = () => {
    if (status.connectUrl) openUrl(status.connectUrl);
  };

  return (
    <View style={[styles.card, colors.shadow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: colors.primary + "14" }]}>
          <Icon name="refresh-cw" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Auto-import from AwardWallet</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {status.linked
              ? `Connected${status.syncedAt ? ` · last synced ${syncedLabel(status.syncedAt)}` : ""}. Pull your latest balances in one tap.`
              : "Connect your AwardWallet to bring every balance in automatically."}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {!status.linked && status.connectUrl ? (
          <Pressable onPress={connect} style={[styles.btn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Connect</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            setNote(null);
            sync.mutate();
          }}
          disabled={sync.isPending}
          style={[styles.btn, { backgroundColor: status.linked ? colors.primary : "transparent", borderWidth: status.linked ? 0 : 1, borderColor: colors.border }]}
        >
          {sync.isPending ? (
            <ActivityIndicator size="small" color={status.linked ? colors.primaryForeground : colors.primary} />
          ) : (
            <Text style={[styles.btnText, { color: status.linked ? colors.primaryForeground : colors.foreground }]}>
              {status.linked ? "Sync now" : "I've connected — sync"}
            </Text>
          )}
        </Pressable>
      </View>

      {note ? <Text style={[styles.note, { color: colors.mutedForeground }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16, marginTop: 16 },
  head: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  badge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginTop: 3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  note: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginTop: 10 },
});
