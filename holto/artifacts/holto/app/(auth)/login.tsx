import { Icon } from "@/components/Icon";
import { router } from "expo-router";
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

import { HoltoLogo } from "@/components/HoltoLogo";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const passwordRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom;

  const validateEmail = () => {
    if (!email.trim()) {
      setFieldErrors((p) => ({ ...p, email: "Please enter your email." }));
      return false;
    }
    if (!emailRegex.test(email.trim())) {
      setFieldErrors((p) => ({ ...p, email: "That doesn't look like a valid email." }));
      return false;
    }
    setFieldErrors((p) => ({ ...p, email: undefined }));
    return true;
  };

  const handleLogin = async () => {
    const ok = validateEmail();
    if (!password) {
      setFieldErrors((p) => ({ ...p, password: "Please enter your password." }));
      return;
    }
    if (!ok) return;

    setError(null);
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      setError((e as Error).message ?? "Couldn't sign you in. Please try again.");
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
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 24, paddingBottom: bottomPad + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <HoltoLogo size="small" inverted />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Welcome back
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Sign in to access your disruption records and rights history.
          </Text>
        </Animated.View>

        {!!error && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.destructive + "18",
                borderColor: colors.destructive + "55",
                borderRadius: colors.radius / 2,
              },
            ]}
          >
            <Icon name="alert-circle" size={14} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          </Animated.View>
        )}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Email
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: fieldErrors.email ? colors.destructive : colors.border,
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
                setFieldErrors((p) => ({ ...p, email: undefined }));
                setError(null);
              }}
              onBlur={validateEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            {!!fieldErrors.email && (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {fieldErrors.email}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Password
            </Text>
            <View>
              <TextInput
                ref={passwordRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: fieldErrors.password ? colors.destructive : colors.border,
                    color: colors.foreground,
                    borderRadius: colors.radius,
                    fontFamily: "Inter_400Regular",
                    paddingRight: 52,
                  },
                ]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                  setError(null);
                }}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              >
                <Icon
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
            {!!fieldErrors.password && (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {fieldErrors.password}
              </Text>
            )}
            <Pressable
              style={styles.forgotLink}
              onPress={() => router.push("/(auth)/forgot-password" as never)}
              accessibilityRole="button"
              accessibilityLabel="Forgot your password"
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot password?</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: loading ? colors.muted : colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
          onPress={handleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Sign in</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switchLink}
          onPress={() => router.replace("/(auth)/register")}
        >
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            Don't have an account?{" "}
            <Text
              style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}
            >
              Create one
            </Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    marginBottom: 28,
  },
  header: { marginBottom: 28 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 23,
  },
  errorBox: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  form: { gap: 18, marginBottom: 28 },
  field: { gap: 6 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    letterSpacing: 0.1,
  },
  input: {
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  eyeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldError: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  forgotLink: { alignSelf: "flex-end", paddingVertical: 4, marginTop: 2 },
  forgotText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  submitBtn: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  submitBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: "#fff",
  },
  switchLink: { alignItems: "center" },
  switchText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
