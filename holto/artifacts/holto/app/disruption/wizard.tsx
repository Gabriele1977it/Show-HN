import { Icon } from "@/components/Icon";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListDisruptionsQueryKey,
  useCreateDisruption,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
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
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StepBar } from "@/components/StepBar";
import { useColors } from "@/hooks/useColors";
import type { DisruptionType } from "@/context/WizardContext";

interface WizardData {
  disruptionType: DisruptionType | null;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledAt: string;
  details: string;
}

const DISRUPTION_TYPES: {
  type: DisruptionType;
  label: string;
  desc: string;
  icon: string;
}[] = [
  {
    type: "delay",
    label: "Delayed Flight",
    desc: "My flight is running late",
    icon: "clock",
  },
  {
    type: "cancellation",
    label: "Cancelled Flight",
    desc: "My flight was cancelled",
    icon: "x-circle",
  },
  {
    type: "missed_connection",
    label: "Missed Connection",
    desc: "I've missed a connecting flight",
    icon: "shuffle",
  },
  {
    type: "denied_boarding",
    label: "Denied Boarding",
    desc: "I was not allowed to board",
    icon: "slash",
  },
];

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "What happened?",
  "Which airline?",
  "Flight number?",
  "Your route?",
  "Scheduled departure?",
  "Any other details?",
];

const STEP_SUBTITLES = [
  "Choose the option that best matches your situation.",
  "Enter the operating airline name.",
  "Check your booking confirmation.",
  "Airport codes or city names — either is fine.",
  "When was your flight supposed to leave?",
  "Optional — but more detail means more precise guidance.",
];

export default function WizardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { mutateAsync: createDisruption } = useCreateDisruption();

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    disruptionType: null,
    airline: "",
    flightNumber: "",
    origin: "",
    destination: "",
    scheduledAt: "",
    details: "",
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (partial: Partial<WizardData>) => {
    setFieldError(null);
    setData((prev) => ({ ...prev, ...partial }));
  };

  const validate = (): boolean => {
    switch (step) {
      case 0:
        if (!data.disruptionType) {
          setFieldError("Please select what happened to your flight.");
          return false;
        }
        break;
      case 1:
        if (!data.airline.trim()) {
          setFieldError("Please enter the airline name.");
          return false;
        }
        if (data.airline.trim().length < 2) {
          setFieldError("That doesn't look like an airline name.");
          return false;
        }
        break;
      case 2:
        if (!data.flightNumber.trim()) {
          setFieldError("Please enter your flight number.");
          return false;
        }
        if (data.flightNumber.trim().length < 2) {
          setFieldError("Please enter a valid flight number (e.g. BA245).");
          return false;
        }
        break;
      case 3:
        if (!data.origin.trim() || data.origin.trim().length < 2) {
          setFieldError("Please enter your departure airport or city.");
          return false;
        }
        if (!data.destination.trim() || data.destination.trim().length < 2) {
          setFieldError("Please enter your arrival airport or city.");
          return false;
        }
        break;
      case 4:
        if (!data.scheduledAt.trim()) {
          setFieldError("Please enter the scheduled departure time.");
          return false;
        }
        break;
      case 5:
        break;
    }
    return true;
  };

  const next = () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const back = () => {
    setFieldError(null);
    if (step === 0) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!data.disruptionType) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createDisruption({
        data: {
          airline: data.airline.trim(),
          flightNumber: data.flightNumber.trim().toUpperCase(),
          origin: data.origin.trim().toUpperCase(),
          destination: data.destination.trim().toUpperCase(),
          scheduledAt: data.scheduledAt.trim(),
          disruptionType: data.disruptionType,
          details: data.details.trim() || "No additional details provided.",
        },
      });
      qc.invalidateQueries({ queryKey: getListDisruptionsQueryKey() });
      router.replace(`/disruption/${result.id}`);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      const friendly = msg.includes("network") || msg.includes("fetch")
        ? "No connection — please check your wifi and try again."
        : "Couldn't submit right now. Your answers are saved — tap below to retry.";
      setSubmitError(friendly);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
      borderRadius: colors.radius,
      fontFamily: "Inter_400Regular" as const,
    },
  ];

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.typeGrid}>
              {DISRUPTION_TYPES.map((t) => {
                const isSelected = data.disruptionType === t.type;
                return (
                  <Pressable
                    key={t.type}
                    style={({ pressed }) => [
                      styles.typeCard,
                      {
                        backgroundColor: isSelected ? colors.midnight : colors.card,
                        borderColor: isSelected ? colors.teal : colors.border,
                        borderRadius: colors.radius,
                        opacity: pressed ? 0.87 : 1,
                        borderWidth: isSelected ? 1.5 : 1,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      update({ disruptionType: t.type });
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={t.label}
                  >
                    <Icon
                      name={t.icon as string}
                      size={20}
                      color={isSelected ? colors.aqua : colors.primary}
                    />
                    <Text
                      style={[
                        styles.typeLabel,
                        { color: isSelected ? "#F4F7F8" : colors.foreground },
                      ]}
                    >
                      {t.label}
                    </Text>
                    <Text
                      style={[
                        styles.typeDesc,
                        {
                          color: isSelected
                            ? "rgba(244,247,248,0.65)"
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {t.desc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={inputStyle}
              placeholder="e.g. British Airways"
              placeholderTextColor={colors.mutedForeground}
              value={data.airline}
              onChangeText={(v) => update({ airline: v })}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={next}
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={inputStyle}
              placeholder="e.g. BA245"
              placeholderTextColor={colors.mutedForeground}
              value={data.flightNumber}
              onChangeText={(v) => update({ flightNumber: v })}
              autoCapitalize="characters"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={next}
            />
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <View style={styles.routeRow}>
              <View style={styles.routeField}>
                <Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>
                  From
                </Text>
                <TextInput
                  style={[inputStyle, { textAlign: "center" }]}
                  placeholder="LHR"
                  placeholderTextColor={colors.mutedForeground}
                  value={data.origin}
                  onChangeText={(v) => update({ origin: v })}
                  autoCapitalize="characters"
                  autoFocus
                  returnKeyType="next"
                />
              </View>
              <Icon
                name="arrow-right"
                size={18}
                color={colors.mutedForeground}
                style={styles.routeArrow}
              />
              <View style={styles.routeField}>
                <Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>
                  To
                </Text>
                <TextInput
                  style={[inputStyle, { textAlign: "center" }]}
                  placeholder="CDG"
                  placeholderTextColor={colors.mutedForeground}
                  value={data.destination}
                  onChangeText={(v) => update({ destination: v })}
                  autoCapitalize="characters"
                  returnKeyType="next"
                  onSubmitEditing={next}
                />
              </View>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={inputStyle}
              placeholder="e.g. 14 June 2026 at 10:30"
              placeholderTextColor={colors.mutedForeground}
              value={data.scheduledAt}
              onChangeText={(v) => update({ scheduledAt: v })}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={next}
            />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Date and time help us calculate your rights accurately.
            </Text>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={[
                inputStyle,
                {
                  height: 140,
                  paddingTop: 14,
                  paddingBottom: 14,
                  textAlignVertical: "top",
                },
              ]}
              placeholder="e.g. The airline told us the flight is delayed by 4 hours with no explanation. We are at the gate and they haven't offered any vouchers."
              placeholderTextColor={colors.mutedForeground}
              value={data.details}
              onChangeText={(v) => update({ details: v })}
              multiline
              autoFocus
            />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              This step is optional, but the more context you give, the more accurate your guidance will be.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.progressWrap}>
        <StepBar step={step} total={TOTAL_STEPS} />
        <Text style={[styles.stepCount, { color: colors.mutedForeground }]}>
          {step + 1} of {TOTAL_STEPS}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            {STEP_TITLES[step]}
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            {STEP_SUBTITLES[step]}
          </Text>
        </View>

        {renderStep()}

        {!!fieldError && (
          <Animated.View entering={FadeInRight.duration(250)} style={styles.fieldErrorWrap}>
            <Icon name="alert-circle" size={13} color={colors.destructive} />
            <Text style={[styles.fieldErrorText, { color: colors.destructive }]}>
              {fieldError}
            </Text>
          </Animated.View>
        )}

        {!!submitError && (
          <Animated.View
            entering={FadeInRight.duration(300)}
            style={[
              styles.submitErrorWrap,
              {
                backgroundColor: "#FDF0F0",
                borderColor: "#EAACAC",
                borderRadius: colors.radius / 2,
              },
            ]}
          >
            <Icon name="wifi-off" size={14} color={colors.destructive} />
            <Text style={[styles.submitErrorText, { color: colors.destructive }]}>
              {submitError}
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: bottomPad + 16,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={back}
          accessibilityLabel={step === 0 ? "Cancel" : "Go back"}
        >
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            {
              backgroundColor: submitting ? colors.muted : colors.primary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.88 : 1,
              flex: 1,
            },
          ]}
          onPress={submitError ? handleSubmit : next}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={
            submitting
              ? "Analysing your situation"
              : submitError
              ? "Try again"
              : step === TOTAL_STEPS - 1
              ? "Get my rights"
              : "Continue"
          }
        >
          {submitting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.nextBtnText}>Analysing…</Text>
            </View>
          ) : (
            <Text style={styles.nextBtnText}>
              {submitError
                ? "Try again"
                : step === TOTAL_STEPS - 1
                ? "Get my rights"
                : "Continue"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 6,
  },
  stepCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  stepHeader: { marginBottom: 28 },
  stepTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 33,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  stepContent: {},
  typeGrid: { gap: 10 },
  typeCard: {
    padding: 16,
    borderWidth: 1,
    gap: 3,
  },
  typeLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginTop: 6,
  },
  typeDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  routeField: {
    flex: 1,
    gap: 6,
  },
  routeLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  routeArrow: {
    marginBottom: 14,
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  fieldErrorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  fieldErrorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
  },
  submitErrorWrap: {
    borderWidth: 1,
    padding: 12,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  submitErrorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
