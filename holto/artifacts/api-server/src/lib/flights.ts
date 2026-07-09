import OpenAI from "openai";

import { logger } from "./logger";
import { candidateFlightNumbers, mapStatus, type FlightStatus } from "./flight-format";

// Shared flight-status logic used by both the `/flights/status` route and the
// background monitor worker, so there is one implementation of AirLabs querying,
// status mapping, and response shaping. Pure number/status helpers live in
// `flight-format.ts`; they are re-exported here for existing import sites.

export { candidateFlightNumbers, mapStatus } from "./flight-format";
export type { FlightStatus } from "./flight-format";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "no-key" });

export async function generateStatusMessage(flight: Record<string, unknown>): Promise<string | null> {
  const status = mapStatus(flight.status as string);
  const depDelay = typeof flight.dep_delay === "number" ? flight.dep_delay : null;

  const context = [
    `Flight: ${flight.flight_iata ?? "unknown"}`,
    `Route: ${flight.dep_iata ?? "?"} → ${flight.arr_iata ?? "?"}`,
    `Status: ${status}`,
    flight.dep_time ? `Scheduled departure: ${flight.dep_time as string}` : null,
    depDelay != null && depDelay > 0 ? `Departure delay: ${depDelay} minutes` : null,
    flight.dep_gate ? `Gate: ${flight.dep_gate as string}` : null,
    flight.dep_terminal ? `Terminal: ${flight.dep_terminal as string}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `You are HOLTO, a calm and warm travel companion. Write ONE short, friendly sentence (max 22 words) about this flight status. Be specific, reassuring, and useful. Sound like a knowledgeable friend, not a robot. Context: ${context}`,
        },
      ],
      max_tokens: 80,
      temperature: 0.4,
    });
    return res.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

async function tryAirlabsEndpoint(url: string, label: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fetch(url);
    const body = await raw.text();

    if (!raw.ok) {
      logger.warn({ label, status: raw.status, body }, "AirLabs non-OK response");
      return null;
    }

    let data: { response?: unknown; error?: unknown };
    try {
      data = JSON.parse(body) as typeof data;
    } catch {
      logger.warn({ label, body }, "AirLabs non-JSON response");
      return null;
    }

    if (data.error) {
      logger.warn({ label, error: data.error }, "AirLabs error in response body");
      return null;
    }

    return data as Record<string, unknown>;
  } catch (err) {
    logger.warn({ label, err }, "AirLabs fetch failed");
    return null;
  }
}

function normaliseScheduleRow(row: Record<string, unknown>): Record<string, unknown> {
  // Schedules endpoint uses dep_time / arr_time as ISO-like strings
  const depTime = (row.dep_time ?? row.dep_time_utc ?? null) as string | null;
  const arrTime = (row.arr_time ?? row.arr_time_utc ?? null) as string | null;

  return {
    flight_iata: row.flight_iata ?? row.flight_number ?? row.flight_icao,
    airline_iata: row.airline_iata ?? row.airline_icao,
    status: row.status ?? "scheduled",
    dep_iata: row.dep_iata,
    arr_iata: row.arr_iata,
    dep_time: depTime,
    arr_time: arrTime,
    dep_estimated: null,
    arr_estimated: null,
    dep_delay: typeof row.delayed === "number" ? row.delayed : null,
    arr_delay: null,
    dep_gate: row.dep_gate ?? null,
    dep_terminal: row.dep_terminal ?? null,
    arr_terminal: row.arr_terminal ?? null,
  };
}

export async function fetchFlightData(
  flightNumber: string,
  apiKey: string,
): Promise<Record<string, unknown> | null> {
  const candidates = candidateFlightNumbers(flightNumber);

  for (const fn of candidates) {
    // 1. Try live flight endpoint
    const liveData = await tryAirlabsEndpoint(
      `https://airlabs.co/api/v9/flight?flight_iata=${encodeURIComponent(fn)}&api_key=${apiKey}`,
      `live:${fn}`,
    );
    if (liveData) {
      const flight = liveData.response as Record<string, unknown> | null;
      if (flight && typeof flight === "object" && flight.flight_iata) {
        logger.info({ fn, source: "live" }, "Flight found via live endpoint");
        return flight;
      }
    }

    // 2. Try schedules endpoint
    const schedData = await tryAirlabsEndpoint(
      `https://airlabs.co/api/v9/schedules?flight_iata=${encodeURIComponent(fn)}&api_key=${apiKey}`,
      `schedules:${fn}`,
    );
    if (schedData) {
      const rows = schedData.response as Array<Record<string, unknown>> | null;
      if (Array.isArray(rows) && rows.length > 0) {
        logger.info({ fn, source: "schedules", count: rows.length }, "Flight found via schedules");
        return normaliseScheduleRow(rows[0]);
      }
    }
  }

  return null;
}

export interface FlightResponse {
  flightNumber: string;
  airlineIata: string | null;
  status: FlightStatus;
  depAirport: string | null;
  arrAirport: string | null;
  scheduledDep: string | null;
  estimatedDep: string | null;
  scheduledArr: string | null;
  estimatedArr: string | null;
  depDelay: number | null;
  arrDelay: number | null;
  depGate: string | null;
  depTerminal: string | null;
  arrTerminal: string | null;
  companionMessage: string | null;
  checkedAt: string;
}

export function buildFlightResponse(
  flightNumber: string,
  flight: Record<string, unknown>,
  companionMessage: string | null,
): FlightResponse {
  return {
    flightNumber: (flight.flight_iata as string | null) ?? flightNumber,
    airlineIata: (flight.airline_iata as string | null) ?? null,
    status: mapStatus(flight.status as string),
    depAirport: (flight.dep_iata as string | null) ?? null,
    arrAirport: (flight.arr_iata as string | null) ?? null,
    scheduledDep: (flight.dep_time as string | null) ?? null,
    estimatedDep: (flight.dep_estimated as string | null) ?? null,
    scheduledArr: (flight.arr_time as string | null) ?? null,
    estimatedArr: (flight.arr_estimated as string | null) ?? null,
    depDelay: typeof flight.dep_delay === "number" ? flight.dep_delay : null,
    arrDelay: typeof flight.arr_delay === "number" ? flight.arr_delay : null,
    depGate: (flight.dep_gate as string | null) ?? null,
    depTerminal: (flight.dep_terminal as string | null) ?? null,
    arrTerminal: (flight.arr_terminal as string | null) ?? null,
    companionMessage,
    checkedAt: new Date().toISOString(),
  };
}
