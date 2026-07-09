import { db, monitoredFlightsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import OpenAI from "openai";

import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "no-key" });

type AirlabsStatus = "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted" | "unknown";

// Map common ICAO airline prefixes → IATA codes so users can enter either format.
// AirLabs uses IATA codes in flight_iata queries.
const ICAO_TO_IATA: Record<string, string> = {
  EZY: "U2",  // easyJet
  RYR: "FR",  // Ryanair
  BAW: "BA",  // British Airways
  EIN: "EI",  // Aer Lingus
  WZZ: "W6",  // Wizz Air
  KLM: "KL",  // KLM
  AFR: "AF",  // Air France
  DLH: "LH",  // Lufthansa
  THY: "TK",  // Turkish Airlines
  UAE: "EK",  // Emirates
  QTR: "QR",  // Qatar Airways
  ETD: "EY",  // Etihad
  MSR: "MS",  // EgyptAir
  PGT: "PC",  // Pegasus
  IBE: "IB",  // Iberia
  VIR: "VS",  // Virgin Atlantic
  SWR: "LX",  // Swiss
  AUA: "OS",  // Austrian
  BEL: "SN",  // Brussels Airlines
  TAP: "TP",  // TAP Portugal
};

function candidateFlightNumbers(fn: string): string[] {
  const match = fn.match(/^([A-Z]{2,3})(\d+[A-Z]?)$/);
  if (!match) return [fn];
  const [, prefix, num] = match;
  const iata = ICAO_TO_IATA[prefix];
  // Return both versions: the original and the IATA-converted one
  return iata && iata !== prefix ? [fn, iata + num] : [fn];
}

function mapStatus(raw: string | undefined): AirlabsStatus {
  const valid = ["scheduled", "active", "landed", "cancelled", "incident", "diverted"];
  return valid.includes(raw ?? "") ? (raw as AirlabsStatus) : "unknown";
}

async function generateStatusMessage(flight: Record<string, unknown>): Promise<string | null> {
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

async function fetchFlightData(
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

function buildFlightResponse(
  flightNumber: string,
  flight: Record<string, unknown>,
  companionMessage: string | null,
): Record<string, unknown> {
  return {
    flightNumber: (flight.flight_iata as string | null) ?? flightNumber,
    airlineIata: flight.airline_iata ?? null,
    status: mapStatus(flight.status as string),
    depAirport: flight.dep_iata ?? null,
    arrAirport: flight.arr_iata ?? null,
    scheduledDep: flight.dep_time ?? null,
    estimatedDep: flight.dep_estimated ?? null,
    scheduledArr: flight.arr_time ?? null,
    estimatedArr: flight.arr_estimated ?? null,
    depDelay: typeof flight.dep_delay === "number" ? flight.dep_delay : null,
    arrDelay: typeof flight.arr_delay === "number" ? flight.arr_delay : null,
    depGate: flight.dep_gate ?? null,
    depTerminal: flight.dep_terminal ?? null,
    arrTerminal: flight.arr_terminal ?? null,
    companionMessage,
    checkedAt: new Date().toISOString(),
  };
}

router.get("/flights/status", requireAuth, async (req, res): Promise<void> => {
  const flightNumber = (req.query.flightNumber as string)?.trim().toUpperCase();
  if (!flightNumber) {
    res.status(400).json({ error: "Flight number is required (e.g. EZY8743)." });
    return;
  }

  const apiKey = process.env.AIRLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Flight tracking is not configured." });
    return;
  }

  req.log.info({ flightNumber }, "Fetching flight status");
  const flight = await fetchFlightData(flightNumber, apiKey);

  if (!flight) {
    req.log.warn({ flightNumber }, "Flight not found in any AirLabs endpoint");
    res.status(404).json({
      error: `Flight ${flightNumber} not found. It may not be in the database yet — try again closer to the departure date, or check the flight number is correct.`,
    });
    return;
  }

  const companionMessage = await generateStatusMessage(flight);
  res.json(buildFlightResponse(flightNumber, flight, companionMessage));
});

router.get("/flights/monitor", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(monitoredFlightsTable)
    .where(and(eq(monitoredFlightsTable.userId, req.auth!.userId), eq(monitoredFlightsTable.active, true)))
    .orderBy(desc(monitoredFlightsTable.createdAt));

  res.json(
    rows.map((r) => ({
      id: r.id,
      flightNumber: r.flightNumber,
      destination: r.destination,
      lastStatus: r.lastStatus ?? null,
      lastCheckedAt: r.lastCheckedAt ?? null,
      createdAt: r.createdAt,
    })),
  );
});

router.post("/flights/monitor", requireAuth, async (req, res): Promise<void> => {
  const { flightNumber, destination } = req.body as { flightNumber?: string; destination?: string };

  if (!flightNumber?.trim() || !destination?.trim()) {
    res.status(400).json({ error: "Flight number and destination are required." });
    return;
  }

  const [row] = await db
    .insert(monitoredFlightsTable)
    .values({
      userId: req.auth!.userId,
      flightNumber: flightNumber.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      active: true,
    })
    .returning();

  res.status(201).json({
    id: row.id,
    flightNumber: row.flightNumber,
    destination: row.destination,
    lastStatus: row.lastStatus ?? null,
    lastCheckedAt: row.lastCheckedAt ?? null,
    createdAt: row.createdAt,
  });
});

router.delete("/flights/monitor/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id." });
    return;
  }

  const [row] = await db
    .update(monitoredFlightsTable)
    .set({ active: false })
    .where(and(eq(monitoredFlightsTable.id, id), eq(monitoredFlightsTable.userId, req.auth!.userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Monitored flight not found." });
    return;
  }

  res.status(204).send();
});

export default router;
