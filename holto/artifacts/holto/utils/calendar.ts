import * as Linking from "expo-linking";
import { Platform } from "react-native";

// Dependency-free "add to calendar": builds a standard iCalendar (.ics) file and
// hands it to the OS. On web (the PWA) it downloads the file, which every
// calendar app imports; on native it opens the data URI so the calendar app can
// add it. No backend, no paid service.

export interface CalEvent {
  title: string;
  start: string; // ISO
  end?: string | null; // ISO
  location?: string | null;
  description?: string | null;
}

function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(ev: CalEvent): string {
  const start = toUtcStamp(ev.start);
  // Default to a 2-hour block when no end is known.
  const end = ev.end ? toUtcStamp(ev.end) : toUtcStamp(new Date(new Date(ev.start).getTime() + 2 * 60 * 60 * 1000).toISOString());
  const uid = `holto-${Date.now()}-${Math.random().toString(36).slice(2)}@holtotravel.com`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HOLTO//Travel//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escape(ev.title)}`,
    ev.location ? `LOCATION:${escape(ev.location)}` : "",
    ev.description ? `DESCRIPTION:${escape(ev.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export async function addToCalendar(ev: CalEvent): Promise<void> {
  const ics = buildIcs(ev);

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ev.title.replace(/[^\w-]+/g, "_").slice(0, 40) || "event"}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const dataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  try {
    await Linking.openURL(dataUri);
  } catch {
    /* best effort — some native mail/calendar apps decline data URIs */
  }
}
