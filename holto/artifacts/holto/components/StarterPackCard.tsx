import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  defaultEmail?: string;
  alreadySubscribed?: boolean;
  onSubscribe: (email: string) => Promise<void>;
}

export function StarterPackCard({ defaultEmail = "", alreadySubscribed = false, onSubscribe }: Props) {
  const colors = useColors();
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(alreadySubscribed);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubscribe(trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch {
      setError("Couldn't save that — please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: "#F0FAF0",
            borderColor: "#A8D5A8",
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.successRow}>
          <Icon name="check-circle" size={18} color="#3A8A3A" />
          <Text style={[styles.successText, { color: "#2A6A2A" }]}>
            Your Hurghada Starter Pack is on its way.
          </Text>
        </View>
        <Text style={[styles.successSub, { color: "#4A7A4A" }]}>
          One email, then nothing unless you want more. Unsubscribe in one tap.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: "#FAFAF7",
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.muted, borderRadius: 8 },
          ]}
        >
          <Icon name="gift" size={16} color={colors.teal} />
        </View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Free resource
        </Text>
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>
        Hurghada Starter Pack
      </Text>
      <Text style={[styles.desc, { color: colors.mutedForeground }]}>
        Practical info for the Red Sea coast — where to stay, how things work, what no one tells you. Useful whether you're visiting or considering a longer stay.
      </Text>

      {error && (
        <Text style={[styles.errorText, { color: colors.destructive }]}>
          {error}
        </Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: error ? colors.destructive : colors.border,
              color: colors.foreground,
              borderRadius: colors.radius / 2,
              fontFamily: "Inter_400Regular",
              flex: 1,
            },
          ]}
          placeholder="Your email"
          placeholderTextColor={colors.mutedForeground}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(null); }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          editable={!loading}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: loading ? colors.muted : colors.accent,
              borderRadius: colors.radius / 2,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendBtnText}>Send it</Text>
          )}
        </Pressable>
      </View>

      <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
        We'll only email your pack. Nothing else without your say-so. Unsubscribe in one tap, anytime.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    marginBottom: 6,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  input: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  sendBtn: {
    height: 44,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  sendBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  privacyNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  successText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    flex: 1,
  },
  successSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
});
