/**
 * SVG-based tab icons — zero font-loading dependency.
 * Works identically on iOS, Android, and web.
 * Uses react-native-svg (already installed) with Material Design paths.
 */
import React from "react";
import { Platform } from "react-native";
import Svg, { Path, G, Circle } from "react-native-svg";

export type TabIconName =
  | "home"
  | "airplane"
  | "star"
  | "shield"
  | "globe"
  | "person";

// ---------------------------------------------------------------------------
// SVG path data (24 × 24 viewBox, Material Design–inspired filled icons)
// ---------------------------------------------------------------------------

const PATHS: Record<TabIconName, React.ReactNode> = {
  home: (
    <Path d="M12 3L2 12h3v8h6v-5h2v5h6v-8h3z" />
  ),
  airplane: (
    <Path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z" />
  ),
  star: (
    <Path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  ),
  shield: (
    <Path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
  ),
  globe: (
    <G>
      <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </G>
  ),
  person: (
    <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  ),
};

// ---------------------------------------------------------------------------

interface Props {
  name: TabIconName;
  color: string;
  size?: number;
}

export function TabSvgIcon({ name, color, size = 23 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
    >
      {PATHS[name]}
    </Svg>
  );
}
