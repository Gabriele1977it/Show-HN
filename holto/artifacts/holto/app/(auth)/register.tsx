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

export default function RegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const emailRef = useRef<TextInput>(null);
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

  const validatePassword = () => {
    if (password.length < 8) {
      setFieldErrors((p) => ({
        ...p,
        password: "Password must be at least 8 characters.",
      }));
      return false;
    }
    setFieldErrors((p) => ({ ...p, password: undefined }));
    return true;
  };

  const handleRegister = async () => {
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = "Please enter your name.";
    const emailOk = validateEmail();
    const passOk = validatePassword();
    if (errs.name) setFieldErrors((p) => ({ ...p, ...errs }));
    if (!emailOk || !passOk || errs.name) return;

    setError(null);
    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
    } catch (e) {
      setError((e as Error).message ?? "Couldn't create your account. Please try again.");
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
            Create your account
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We'll save your disruptions and rights records so you can act on them any time.
          </Text>
        </Animated.View>

        {!!error && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[
              styles.errorBox,
              {
                backgroundColor: "#FDF0F0",
                borderColor: "#EAACAC",
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
              Your name
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: fieldErrors.name ? colors.destructive : colors.border,
                  color: colors.foreground,
                  borderRadius: colors.radius,
                  fontFamily: "Inter_400Regular",
                },
              ]}
              placeholder="Alex Smith"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setFieldErrors((p) => ({ ...p, name: undefined }));
              }}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
            {!!fieldErrors.name && (
              <Text style={[styles.fieldError, { color: colors.destructive }]}>
                {fieldErrors.name}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Email
            </Text>
            <TextInput
              ref={emailRef}
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
                placeholder="At least 8 characters"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setFieldErrors((p) => ({ ...p, password: undefined }));
                }}
                onBlur={validatePassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
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
            {!fieldErrors.password && password.length > 0 && password.length < 8 && (
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                {8 - password.length} more character{8 - password.length !== 1 ? "s" : ""} needed
              </Text>
            )}
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
          onPress={handleRegister}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Create account"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Create account</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.switchLink}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
            <Text
              style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}
            >
              Sign in
            </Text>
          </Text>
        </Pressable>

        <Text style={[styles.legalNote, { color: colors.mutedForeground }]}>
          We collect only what we need. Your data is never sold. GDPR compliant.
        </Text>
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
  fieldHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
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
  switchLink: { alignItems: "center", marginBottom: 20 },
  switchText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  legalNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
