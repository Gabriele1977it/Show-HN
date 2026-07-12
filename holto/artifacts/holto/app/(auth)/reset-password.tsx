import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
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

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { resetPassword } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom;

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
    } catch (e) {
      setError((e as Error).message ?? "Couldn't reset your password. Please try again.");
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
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Choose a new password</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Pick something you'll remember — at least 8 characters. You'll be signed in right after.
          </Text>
        </Animated.View>

        {!token ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "55", borderRadius: colors.radius / 2 }]}
          >
            <Icon name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              This reset link is missing its token. Please open the link from your email again, or request a new one.
            </Text>
          </Animated.View>
        ) : null}

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
          <Text style={[styles.label, { color: colors.mutedForeground }]}>New password</Text>
          <View>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: "Inter_400Regular", paddingRight: 52 }]}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(null);
              }}
              secureTextEntry={!showPassword}
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)} accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
              <Icon name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirm password</Text>
          <TextInput
            ref={confirmRef}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, fontFamily: "Inter_400Regular" }]}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              setError(null);
            }}
            secureTextEntry={!showPassword}
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitBtn, { backgroundColor: loading || !token ? colors.muted : colors.primary, borderRadius: colors.radius, opacity: pressed ? 0.88 : 1 }]}
          onPress={handleSubmit}
          disabled={loading || !token}
          accessibilityRole="button"
          accessibilityLabel="Set new password"
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Set new password</Text>}
        </Pressable>

        <Pressable style={styles.switchLink} onPress={() => router.replace("/(auth)/login")}>
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            Back to{" "}
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>sign in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  header: { marginBottom: 28, marginTop: 20 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23 },
  errorBox: { borderWidth: 1, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, flex: 1 },
  field: { gap: 6, marginBottom: 18 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, letterSpacing: 0.1 },
  input: { height: 52, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  eyeBtn: { position: "absolute", right: 0, top: 0, bottom: 0, width: 52, alignItems: "center", justifyContent: "center" },
  submitBtn: { height: 56, alignItems: "center", justifyContent: "center", marginTop: 6, marginBottom: 20 },
  submitBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: "#fff" },
  switchLink: { alignItems: "center" },
  switchText: { fontFamily: "Inter_400Regular", fontSize: 14 },
});
