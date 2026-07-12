import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom;

  const handleSubmit = async () => {
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const message = await forgotPassword(email.trim().toLowerCase());
      setSent(message);
    } catch (e) {
      setError((e as Error).message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 24, paddingBottom: bottomPad + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Go back">
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Reset your password</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Enter the email you sign in with and we'll send you a secure link to choose a new password.
          </Text>
        </Animated.View>

        {sent ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.successBox, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "44", borderRadius: colors.radius }]}
          >
            <Text style={{ fontSize: 30 }}>📬</Text>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>Check your inbox</Text>
            <Text style={[styles.successText, { color: colors.mutedForeground }]}>{sent}</Text>
            <Text style={[styles.successText, { color: colors.mutedForeground }]}>
              The link expires in 1 hour. If it doesn't arrive, check your spam folder.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.88 : 1, alignSelf: "stretch", marginTop: 20 }]}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.submitBtnText}>Back to sign in</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {!!error && (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "55", borderRadius: colors.radius / 2 }]}
              >
                <Icon name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </Animated.View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: error ? colors.destructive : colors.border,
                    color: colors.foreground,
                    borderRadius: colors.radius,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: loading ? colors.muted : colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.88 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Send reset link"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Send reset link</Text>}
            </Pressable>

            <Pressable style={styles.switchLink} onPress={() => router.replace("/(auth)/login")}>
              <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
                Remembered it?{" "}
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Sign in</Text>
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: { width: 44, height: 44, justifyContent: "center", marginBottom: 28 },
  header: { marginBottom: 28 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23 },
  errorBox: { borderWidth: 1, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, flex: 1 },
  successBox: { borderWidth: 1, padding: 24, alignItems: "center", gap: 10 },
  successTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  successText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 21, textAlign: "center" },
  field: { gap: 6, marginBottom: 24 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, letterSpacing: 0.1 },
  input: { height: 52, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  submitBtn: { height: 56, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  submitBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: "#fff" },
  switchLink: { alignItems: "center" },
  switchText: { fontFamily: "Inter_400Regular", fontSize: 14 },
});
