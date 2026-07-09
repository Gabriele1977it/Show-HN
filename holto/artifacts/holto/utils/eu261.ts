export const AIRPORTS: Record<string, { name: string; city: string; lat: number; lon: number }> = {
  LGW: { name: "London Gatwick", city: "London", lat: 51.1481, lon: -0.1903 },
  LHR: { name: "London Heathrow", city: "London", lat: 51.4775, lon: -0.4614 },
  STN: { name: "London Stansted", city: "London", lat: 51.885, lon: 0.235 },
  LTN: { name: "London Luton", city: "London", lat: 51.8747, lon: -0.3683 },
  MAN: { name: "Manchester", city: "Manchester", lat: 53.3537, lon: -2.275 },
  BHX: { name: "Birmingham", city: "Birmingham", lat: 52.4539, lon: -1.748 },
  EDI: { name: "Edinburgh", city: "Edinburgh", lat: 55.95, lon: -3.3725 },
  GLA: { name: "Glasgow", city: "Glasgow", lat: 55.8719, lon: -4.4331 },
  BRS: { name: "Bristol", city: "Bristol", lat: 51.3827, lon: -2.7191 },
  NCL: { name: "Newcastle", city: "Newcastle", lat: 55.0375, lon: -1.6917 },
  LPL: { name: "Liverpool John Lennon", city: "Liverpool", lat: 53.3336, lon: -2.8497 },
  LBA: { name: "Leeds Bradford", city: "Leeds", lat: 53.8659, lon: -1.6606 },
  HRG: { name: "Hurghada", city: "Hurghada", lat: 27.1783, lon: 33.7994 },
  CAI: { name: "Cairo", city: "Cairo", lat: 30.1219, lon: 31.4056 },
  SSH: { name: "Sharm el-Sheikh", city: "Sharm el-Sheikh", lat: 27.9773, lon: 34.395 },
  LXR: { name: "Luxor", city: "Luxor", lat: 25.671, lon: 32.7067 },
  HBE: { name: "Alexandria Borg el Arab", city: "Alexandria", lat: 30.9177, lon: 29.6963 },
  DXB: { name: "Dubai", city: "Dubai", lat: 25.2528, lon: 55.3644 },
  AUH: { name: "Abu Dhabi", city: "Abu Dhabi", lat: 24.443, lon: 54.6511 },
  DOH: { name: "Doha Hamad", city: "Doha", lat: 25.2605, lon: 51.6138 },
  AMM: { name: "Amman Queen Alia", city: "Amman", lat: 31.7226, lon: 35.9932 },
  IST: { name: "Istanbul", city: "Istanbul", lat: 40.9755, lon: 28.8141 },
  SAW: { name: "Istanbul Sabiha", city: "Istanbul", lat: 40.8983, lon: 29.3092 },
  AYT: { name: "Antalya", city: "Antalya", lat: 36.8987, lon: 30.8004 },
  DLM: { name: "Dalaman", city: "Dalaman", lat: 36.7131, lon: 28.7925 },
  BJV: { name: "Bodrum Milas", city: "Bodrum", lat: 37.2506, lon: 27.6644 },
  BCN: { name: "Barcelona", city: "Barcelona", lat: 41.2974, lon: 2.0833 },
  MAD: { name: "Madrid Barajas", city: "Madrid", lat: 40.4936, lon: -3.5668 },
  PMI: { name: "Palma Mallorca", city: "Palma", lat: 39.5517, lon: 2.7388 },
  TFS: { name: "Tenerife South", city: "Tenerife", lat: 28.0445, lon: -16.5725 },
  TFN: { name: "Tenerife North", city: "Tenerife", lat: 28.4827, lon: -16.3415 },
  AGP: { name: "Malaga", city: "Malaga", lat: 36.675, lon: -4.4991 },
  ACE: { name: "Lanzarote", city: "Lanzarote", lat: 28.9455, lon: -13.6052 },
  FUE: { name: "Fuerteventura", city: "Fuerteventura", lat: 28.4527, lon: -13.8638 },
  LPA: { name: "Gran Canaria", city: "Gran Canaria", lat: 27.9319, lon: -15.3866 },
  IBZ: { name: "Ibiza", city: "Ibiza", lat: 38.8729, lon: 1.3731 },
  LIS: { name: "Lisbon", city: "Lisbon", lat: 38.7756, lon: -9.1354 },
  OPO: { name: "Porto", city: "Porto", lat: 41.2481, lon: -8.6814 },
  FAO: { name: "Faro", city: "Algarve", lat: 37.0144, lon: -7.9659 },
  FNC: { name: "Funchal Madeira", city: "Madeira", lat: 32.6979, lon: -16.7745 },
  CDG: { name: "Paris CDG", city: "Paris", lat: 49.0097, lon: 2.5479 },
  ORY: { name: "Paris Orly", city: "Paris", lat: 48.7233, lon: 2.3794 },
  NCE: { name: "Nice", city: "Nice", lat: 43.6653, lon: 7.215 },
  AMS: { name: "Amsterdam Schiphol", city: "Amsterdam", lat: 52.3105, lon: 4.7683 },
  FRA: { name: "Frankfurt", city: "Frankfurt", lat: 50.0379, lon: 8.5622 },
  MUC: { name: "Munich", city: "Munich", lat: 48.3538, lon: 11.7861 },
  BER: { name: "Berlin Brandenburg", city: "Berlin", lat: 52.3667, lon: 13.5033 },
  FCO: { name: "Rome Fiumicino", city: "Rome", lat: 41.8003, lon: 12.2389 },
  MXP: { name: "Milan Malpensa", city: "Milan", lat: 45.6306, lon: 8.7281 },
  VCE: { name: "Venice Marco Polo", city: "Venice", lat: 45.5053, lon: 12.3519 },
  ATH: { name: "Athens", city: "Athens", lat: 37.9364, lon: 23.9445 },
  HER: { name: "Heraklion Crete", city: "Crete", lat: 35.3397, lon: 25.1803 },
  RHO: { name: "Rhodes", city: "Rhodes", lat: 36.4054, lon: 28.0862 },
  SKG: { name: "Thessaloniki", city: "Thessaloniki", lat: 40.5197, lon: 22.9709 },
  CFU: { name: "Corfu", city: "Corfu", lat: 39.6019, lon: 19.9117 },
  ZTH: { name: "Zakynthos", city: "Zakynthos", lat: 37.7509, lon: 20.8843 },
  CHQ: { name: "Chania Crete", city: "Chania", lat: 35.5317, lon: 24.1497 },
  DBV: { name: "Dubrovnik", city: "Dubrovnik", lat: 42.5614, lon: 18.2681 },
  SPU: { name: "Split", city: "Split", lat: 43.5389, lon: 16.2978 },
  DUB: { name: "Dublin", city: "Dublin", lat: 53.4213, lon: -6.2701 },
  BRU: { name: "Brussels", city: "Brussels", lat: 50.901, lon: 4.4844 },
  VIE: { name: "Vienna", city: "Vienna", lat: 48.1102, lon: 16.5697 },
  ZRH: { name: "Zurich", city: "Zurich", lat: 47.4647, lon: 8.5492 },
  GVA: { name: "Geneva", city: "Geneva", lat: 46.2381, lon: 6.1089 },
  PRG: { name: "Prague", city: "Prague", lat: 50.1008, lon: 14.26 },
  BUD: { name: "Budapest", city: "Budapest", lat: 47.4298, lon: 19.2611 },
  WAW: { name: "Warsaw Chopin", city: "Warsaw", lat: 52.1657, lon: 20.9671 },
  KRK: { name: "Krakow", city: "Krakow", lat: 50.0777, lon: 19.7848 },
  CPH: { name: "Copenhagen", city: "Copenhagen", lat: 55.6179, lon: 12.6561 },
  OSL: { name: "Oslo Gardermoen", city: "Oslo", lat: 60.1939, lon: 11.1004 },
  ARN: { name: "Stockholm Arlanda", city: "Stockholm", lat: 59.6519, lon: 17.9186 },
  HEL: { name: "Helsinki", city: "Helsinki", lat: 60.3172, lon: 24.9633 },
  JFK: { name: "New York JFK", city: "New York", lat: 40.6413, lon: -73.7781 },
  EWR: { name: "Newark", city: "New York", lat: 40.6895, lon: -74.1745 },
  LAX: { name: "Los Angeles", city: "Los Angeles", lat: 33.9416, lon: -118.4085 },
  ORD: { name: "Chicago O'Hare", city: "Chicago", lat: 41.9742, lon: -87.9073 },
  MIA: { name: "Miami", city: "Miami", lat: 25.7959, lon: -80.287 },
  YYZ: { name: "Toronto Pearson", city: "Toronto", lat: 43.6772, lon: -79.6306 },
  BKK: { name: "Bangkok Suvarnabhumi", city: "Bangkok", lat: 13.6811, lon: 100.7473 },
  DEL: { name: "Delhi Indira Gandhi", city: "Delhi", lat: 28.5562, lon: 77.1 },
  BOM: { name: "Mumbai", city: "Mumbai", lat: 19.0896, lon: 72.8656 },
  SYD: { name: "Sydney", city: "Sydney", lat: -33.9399, lon: 151.1753 },
};

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function getAirportDistance(from: string, to: string): number | null {
  const a = AIRPORTS[from.toUpperCase()];
  const b = AIRPORTS[to.toUpperCase()];
  if (!a || !b) return null;
  return haversineKm(a.lat, a.lon, b.lat, b.lon);
}

export type DisruptionKind = "delay" | "cancellation" | "denied_boarding" | "missed_connection";

export interface EU261Result {
  eligible: boolean;
  amount: number;
  reducedAmount: number;
  tier: string;
  distKm: number;
  note: string;
  reason?: string;
}

export function calcEU261(
  distKm: number,
  disruptionType: DisruptionKind,
  delayHours?: number,
): EU261Result {
  if (disruptionType === "delay" && (delayHours === undefined || delayHours < 3)) {
    return {
      eligible: false,
      amount: 0,
      reducedAmount: 0,
      tier: "",
      distKm,
      note: "",
      reason: "Delays under 3 hours do not qualify for EU261 compensation.",
    };
  }

  if (disruptionType === "missed_connection") {
    return {
      eligible: false,
      amount: 0,
      reducedAmount: 0,
      tier: "",
      distKm,
      note: "",
      reason: "Missed connections may be covered depending on whether they were booked as a single ticket. Use the delay or cancellation calculator for that leg.",
    };
  }

  let amount: number;
  let tier: string;
  if (distKm <= 1500) {
    amount = 250;
    tier = "Short haul (≤ 1,500 km)";
  } else if (distKm <= 3500) {
    amount = 400;
    tier = "Medium haul (1,500–3,500 km)";
  } else {
    amount = 600;
    tier = "Long haul (> 3,500 km)";
  }

  let note = "";
  if (disruptionType === "delay") {
    note =
      "Amount may be reduced by 50% if the airline re-routes you and you arrive within the permitted re-routing window (2h/3h/4h depending on route).";
  } else if (disruptionType === "cancellation") {
    note =
      "Applies when notified less than 14 days before departure. Amount may be halved if a re-routing alternative is offered within the permitted window.";
  } else if (disruptionType === "denied_boarding") {
    note = "Full amount applies. The airline must also offer you a choice of re-routing or a full refund.";
  }

  return {
    eligible: true,
    amount,
    reducedAmount: amount / 2,
    tier,
    distKm,
    note,
  };
}

export const QUICK_ROUTES: Array<{ label: string; dep: string; arr: string }> = [
  { label: "LGW → HRG", dep: "LGW", arr: "HRG" },
  { label: "MAN → HRG", dep: "MAN", arr: "HRG" },
  { label: "LGW → SSH", dep: "LGW", arr: "SSH" },
  { label: "LHR → CAI", dep: "LHR", arr: "CAI" },
  { label: "LGW → TFS", dep: "LGW", arr: "TFS" },
  { label: "MAN → PMI", dep: "MAN", arr: "PMI" },
  { label: "LHR → DXB", dep: "LHR", arr: "DXB" },
  { label: "LGW → BCN", dep: "LGW", arr: "BCN" },
];
