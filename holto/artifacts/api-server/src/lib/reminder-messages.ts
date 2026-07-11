import type { CountryResidency } from "./residency";

// Pure builders for proactive-reminder payloads. No DB imports, so they're
// unit-testable in isolation.

export interface ReminderMsg {
  refKey: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

// Which residency reminders to send for a set of computed country residencies.
// One per country per status per year; "safe" countries produce nothing.
export function buildResidencyReminders(countries: CountryResidency[], year: number): ReminderMsg[] {
  const out: ReminderMsg[] = [];
  for (const c of countries) {
    if (c.status === "approaching") {
      out.push({
        refKey: `residency:${c.countryCode}:approaching:${year}`,
        kind: "residency",
        title: "Residency heads-up",
        body: `You've spent ${c.daysThisYear} days in ${c.countryName} this year — ${c.daysUntilThreshold} left before the 183-day line.`,
        data: { type: "residency", countryCode: c.countryCode },
      });
    } else if (c.status === "over") {
      out.push({
        refKey: `residency:${c.countryCode}:over:${year}`,
        kind: "residency",
        title: "183-day line passed",
        body: `You've now spent ${c.daysThisYear} days in ${c.countryName} this year — past the 183-day mark. Worth checking your tax position.`,
        data: { type: "residency", countryCode: c.countryCode },
      });
    }
  }
  return out;
}

// Reminder for an upcoming flight timeline item.
export function buildFlightReminder(item: { id: number; title: string; startAt: Date | string | null }): ReminderMsg {
  let time = "";
  if (item.startAt) {
    const d = item.startAt instanceof Date ? item.startAt : new Date(item.startAt);
    if (!Number.isNaN(d.getTime())) {
      time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
    }
  }
  return {
    refKey: `flight:${item.id}`,
    kind: "flight_departure",
    title: "Time to head for the airport",
    body: `Your flight ${item.title}${time ? ` departs at ${time}` : ""} — leave enough time for traffic and security.`,
    data: { type: "flight_departure", tripItemId: item.id },
  };
}
