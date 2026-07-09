import type { FlightStatus } from "./flight-format";

// Pure decision logic for proactive alerts — kept free of any I/O (no db, no
// network) so it is trivially unit-testable. `monitor.ts` wires it to the poll
// loop and alert delivery.

// Delay thresholds (minutes) at which a proactive alert is worthwhile.
// 120m ≈ EU261 "duty of care" territory; 180m ≈ likely cash compensation.
export const DELAY_WARN_MIN = 120;
export const DELAY_COMP_MIN = 180;

const BAD_STATUSES: ReadonlySet<FlightStatus> = new Set(["cancelled", "diverted", "incident"]);

export interface FlightSnapshot {
  status: FlightStatus;
  depDelay: number | null;
}

export type AlertSeverity = "warning" | "critical";

export interface StatusChange {
  severity: AlertSeverity;
  reason: string;
}

/**
 * Given the previously observed snapshot (or null on the first observation) and
 * the current one, decide whether a proactive alert is warranted, and why.
 * Returns null when nothing material changed.
 *
 * Because the caller persists `next` after each poll, the next call sees
 * `prev === next` and reports no change — so the same state is never re-alerted.
 */
export function detectStatusChange(
  prev: FlightSnapshot | null,
  next: FlightSnapshot,
): StatusChange | null {
  // Never alert on a data gap; also never overwrite reasoning with unknown.
  if (next.status === "unknown") return null;

  const wasBad = prev ? BAD_STATUSES.has(prev.status) : false;
  const isBad = BAD_STATUSES.has(next.status);

  // Newly disrupted (cancelled / diverted / incident) — the critical case.
  if (isBad && !wasBad) {
    const label =
      next.status === "cancelled"
        ? "cancelled"
        : next.status === "diverted"
          ? "diverted"
          : "reporting an incident";
    return { severity: "critical", reason: `Your flight is ${label}.` };
  }

  // Delay crossing a threshold (only when not already flagged as disrupted).
  if (!isBad) {
    const prevDelay = prev?.depDelay ?? 0;
    const nextDelay = next.depDelay ?? 0;

    if (prevDelay < DELAY_COMP_MIN && nextDelay >= DELAY_COMP_MIN) {
      return {
        severity: "warning",
        reason: `Delayed ${nextDelay} min — a 3h+ delay may mean you're owed compensation.`,
      };
    }
    if (prevDelay < DELAY_WARN_MIN && nextDelay >= DELAY_WARN_MIN) {
      return {
        severity: "warning",
        reason: `Delayed ${nextDelay} min — you may be owed care (meals/refreshments).`,
      };
    }
  }

  return null;
}
