// Deterministic "when to leave for the airport" maths. Pure and testable; the
// live drive time is fetched separately (Google Directions) and passed in, so
// this stays independent of any external service.

export type TripType = "domestic" | "international";

// Recommended time at the airport before departure.
export const ARRIVAL_BUFFER_MIN: Record<TripType, number> = {
  domestic: 120,
  international: 180,
};

export interface LeaveTimeInput {
  departureAt: string; // ISO datetime of the flight's scheduled departure
  driveMinutes: number; // door-to-airport travel time (with traffic)
  tripType: TripType;
}

export interface LeaveTimeResult {
  recommendedArrivalMinutes: number;
  driveMinutes: number;
  arriveAirportBy: string; // ISO — be at the airport by this time
  leaveBy: string; // ISO — leave your location by this time
  totalLeadMinutes: number; // arrival buffer + drive
}

export function computeLeaveTime(input: LeaveTimeInput): LeaveTimeResult | null {
  const dep = new Date(input.departureAt);
  if (Number.isNaN(dep.getTime())) return null;
  const drive = Math.max(0, Math.round(input.driveMinutes));
  const buffer = ARRIVAL_BUFFER_MIN[input.tripType];

  const arriveAirportBy = new Date(dep.getTime() - buffer * 60_000);
  const leaveBy = new Date(arriveAirportBy.getTime() - drive * 60_000);

  return {
    recommendedArrivalMinutes: buffer,
    driveMinutes: drive,
    arriveAirportBy: arriveAirportBy.toISOString(),
    leaveBy: leaveBy.toISOString(),
    totalLeadMinutes: buffer + drive,
  };
}

// Whole minutes from `nowIso` until `targetIso` (negative = already past).
export function minutesUntil(targetIso: string, nowIso: string): number {
  const t = new Date(targetIso).getTime();
  const n = new Date(nowIso).getTime();
  if (Number.isNaN(t) || Number.isNaN(n)) return NaN;
  return Math.round((t - n) / 60_000);
}
