import React from "react";
import { Platform, StyleSheet, TextInput, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  value: string; // "YYYY-MM-DD" for date, "HH:MM" for time
  onChange: (v: string) => void;
  mode?: "date" | "time";
  placeholder?: string;
  flex?: number;
}

// A themed date/time field. On web (the PWA) it renders a real
// <input type="date|time">, so tapping it opens the browser's native visual
// calendar / clock picker instead of forcing the user to type a format. On
// native it falls back to a text field.
export function DateField({ value, onChange, mode = "date", placeholder, flex }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();

  if (Platform.OS === "web") {
    const props: Record<string, unknown> = {
      type: mode,
      value: value || "",
      placeholder,
      onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      style: {
        height: 48,
        boxSizing: "border-box",
        width: "100%",
        minWidth: 0,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        background: colors.card,
        color: colors.foreground,
        padding: "0 12px",
        fontSize: 15,
        fontFamily: "Inter_500Medium",
        outline: "none",
        colorScheme: scheme === "dark" ? "dark" : "light",
        ...(flex != null ? { flex } : {}),
      },
    };
    return React.createElement("input", props as never);
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder ?? (mode === "time" ? "HH:MM" : "YYYY-MM-DD")}
      placeholderTextColor={colors.mutedForeground}
      autoCapitalize="none"
      style={[
        styles.native,
        { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
        flex != null ? { flex } : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  native: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
