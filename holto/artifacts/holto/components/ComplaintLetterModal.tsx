import { Icon } from "@/components/Icon";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { AIRPORTS } from "@/utils/eu261";

interface DisruptionData {
  airline?: string | null;
  flightNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  disruptionType?: string | null;
  createdAt?: string | null;
  scheduledAt?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  disruption: DisruptionData;
  compensationAmount?: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  delay: "delay",
  cancellation: "cancellation",
  missed_connection: "missed connection",
  denied_boarding: "denied boarding",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "____________";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "____________";
  }
}

function generateLetter(disruption: DisruptionData, compensationAmount?: number | null): string {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const airline = disruption.airline || "[Airline name]";
  const flightNum = disruption.flightNumber || "[Flight number]";
  const origin = disruption.origin || "[Departure airport]";
  const dest = disruption.destination || "[Arrival airport]";
  const originName = AIRPORTS[origin]?.city ?? origin;
  const destName = AIRPORTS[dest]?.city ?? dest;
  const disruptionType = TYPE_LABELS[disruption.disruptionType ?? ""] ?? disruption.disruptionType ?? "[disruption type]";
  const flightDate = formatDate(disruption.scheduledAt ?? disruption.createdAt);
  const compStr = compensationAmount ? `€${compensationAmount}` : "[compensation amount]";

  return `${today}

${airline}
Customer Relations Department
[Airline address]

Subject: EU/UK Regulation 261/2004 Compensation Claim
Flight ${flightNum} — ${originName} to ${destName} on ${flightDate}

Dear Sir/Madam,

I am writing to formally request compensation under EC Regulation 261/2004 (and its UK equivalent retained in domestic law) for the ${disruptionType} of flight ${flightNum}, operated by ${airline} on ${flightDate}.

FLIGHT DETAILS
Flight number: ${flightNum}
Route: ${origin} (${originName}) → ${dest} (${destName})
Scheduled departure: ${flightDate}
Nature of disruption: ${disruptionType.charAt(0).toUpperCase() + disruptionType.slice(1)}

COMPENSATION CLAIM
Based on the distance of this route, I believe I am entitled to financial compensation of ${compStr} under the applicable regulation.

I request that you:

1. Acknowledge receipt of this letter within 7 days of receiving it.
2. Provide a full written response, including your decision, within 14 days.
3. Process payment of the applicable compensation upon acceptance of this claim.

Please note that I retain all documents relating to this disruption, including my booking confirmation, boarding pass, and any correspondence from your airline.

Should I not receive a satisfactory response within 28 days, I reserve the right to:
• Escalate this complaint to the Civil Aviation Authority (CAA)
• Refer the matter to an approved Alternative Dispute Resolution (ADR) body
• Pursue my claim through the courts

I trust this matter will be resolved promptly and amicably.

Yours faithfully,

[Your full name]
[Your address]
[Your email address]
[Your phone number]
[Your booking reference]
[Your passport/ID number (last 4 digits)]`;
}

export default function ComplaintLetterModal({ visible, onClose, disruption, compensationAmount }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const letter = useMemo(() => generateLetter(disruption, compensationAmount), [disruption, compensationAmount]);

  const handleCopy = async () => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined" && window.navigator?.clipboard) {
        await window.navigator.clipboard.writeText(letter);
      } else {
        await Share.share({ message: letter, title: "Complaint Letter" });
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // silent
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: letter,
        title: `EU261 Complaint – ${disruption.airline ?? ""} ${disruption.flightNumber ?? ""}`,
      });
    } catch {
      // silent
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Platform.OS === "ios" ? insets.bottom + 12 : 24,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>Complaint Letter</Text>
              <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                Pre-filled with your disruption details
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: colors.background }]}>
              <Icon name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={[styles.infoBar, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
            <Icon name="info" size={14} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Fill in the bracketed fields [ ] before sending. Replace with your actual details.
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.letterContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.letterCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.letterText, { color: colors.foreground }]} selectable>
                {letter}
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Icon name={copied ? "check" : "copy"} size={16} color={copied ? "#2ECC71" : colors.foreground} />
              <Text style={[styles.actionBtnText, { color: copied ? "#2ECC71" : colors.foreground }]}>
                {copied ? "Copied!" : "Copy letter"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionBtnPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Icon name="share-2" size={16} color="#fff" />
              <Text style={styles.actionBtnTextPrimary}>Share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 12, flex: 1, lineHeight: 18 },
  letterContainer: { paddingHorizontal: 16, paddingVertical: 14 },
  letterCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  letterText: {
    fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
    fontSize: 12,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
  },
  actionBtnPrimary: { borderWidth: 0 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  actionBtnTextPrimary: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
});
