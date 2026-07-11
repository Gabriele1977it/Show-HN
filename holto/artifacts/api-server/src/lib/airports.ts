// Coordinates for major airports, so we can route to a precise point instead of
// hoping a geocoder resolves a bare IATA code. Approximate to a few hundred
// metres — plenty for a "when to leave" drive estimate. Unknown codes fall back
// to text geocoding ("<CODE> airport").
export interface AirportCoord {
  lat: number;
  lon: number;
}

export const AIRPORTS: Record<string, AirportCoord> = {
  // United Kingdom & Ireland
  LHR: { lat: 51.47, lon: -0.4543 }, LGW: { lat: 51.1537, lon: -0.1821 },
  STN: { lat: 51.886, lon: 0.2389 }, LTN: { lat: 51.8747, lon: -0.3683 },
  LCY: { lat: 51.5053, lon: 0.0553 }, MAN: { lat: 53.365, lon: -2.2728 },
  BHX: { lat: 52.4539, lon: -1.748 }, EDI: { lat: 55.9508, lon: -3.3615 },
  GLA: { lat: 55.8642, lon: -4.4331 }, BRS: { lat: 51.3827, lon: -2.7191 },
  NCL: { lat: 55.0375, lon: -1.6917 }, LPL: { lat: 53.3336, lon: -2.8497 },
  LBA: { lat: 53.8659, lon: -1.6606 }, EMA: { lat: 52.8311, lon: -1.3281 },
  BFS: { lat: 54.6575, lon: -6.2158 }, ABZ: { lat: 57.2019, lon: -2.1978 },
  DUB: { lat: 53.4213, lon: -6.2701 },
  // Europe
  CDG: { lat: 49.0097, lon: 2.5479 }, ORY: { lat: 48.7233, lon: 2.3794 },
  AMS: { lat: 52.3105, lon: 4.7683 }, FRA: { lat: 50.0379, lon: 8.5622 },
  MUC: { lat: 48.3538, lon: 11.7861 }, BER: { lat: 52.3667, lon: 13.5033 },
  DUS: { lat: 51.2895, lon: 6.7668 }, MAD: { lat: 40.4936, lon: -3.5668 },
  BCN: { lat: 41.2974, lon: 2.0833 }, AGP: { lat: 36.6749, lon: -4.4991 },
  ALC: { lat: 38.2822, lon: -0.5582 }, PMI: { lat: 39.5517, lon: 2.7388 },
  LIS: { lat: 38.7742, lon: -9.1342 }, OPO: { lat: 41.2481, lon: -8.6814 },
  FCO: { lat: 41.8003, lon: 12.2389 }, MXP: { lat: 45.6301, lon: 8.7281 },
  VCE: { lat: 45.5053, lon: 12.3519 }, NAP: { lat: 40.886, lon: 14.2908 },
  ATH: { lat: 37.9364, lon: 23.9445 }, VIE: { lat: 48.1103, lon: 16.5697 },
  ZRH: { lat: 47.4647, lon: 8.5492 }, GVA: { lat: 46.2381, lon: 6.109 },
  BRU: { lat: 50.9014, lon: 4.4844 }, CPH: { lat: 55.618, lon: 12.6508 },
  ARN: { lat: 59.6519, lon: 17.9186 }, OSL: { lat: 60.1976, lon: 11.1004 },
  HEL: { lat: 60.3172, lon: 24.9633 }, PRG: { lat: 50.1008, lon: 14.26 },
  WAW: { lat: 52.1657, lon: 20.9671 }, KRK: { lat: 50.0777, lon: 19.7848 },
  BUD: { lat: 47.4369, lon: 19.2556 }, IST: { lat: 41.2753, lon: 28.7519 },
  SAW: { lat: 40.8986, lon: 29.3092 }, LCA: { lat: 34.8751, lon: 33.6249 },
  PFO: { lat: 34.718, lon: 32.4857 }, MLA: { lat: 35.8575, lon: 14.4775 },
  TFS: { lat: 28.0445, lon: -16.5725 }, LPA: { lat: 27.9319, lon: -15.3866 },
  ACE: { lat: 28.9455, lon: -13.6052 }, FUE: { lat: 28.4527, lon: -13.8638 },
  KEF: { lat: 63.985, lon: -22.6056 }, FAO: { lat: 37.0144, lon: -7.9659 },
  DBV: { lat: 42.5614, lon: 18.2682 }, SPU: { lat: 43.5389, lon: 16.2981 },
  // Middle East & Africa
  DXB: { lat: 25.2532, lon: 55.3657 }, AUH: { lat: 24.433, lon: 54.6511 },
  DOH: { lat: 25.2731, lon: 51.6081 }, CAI: { lat: 30.1219, lon: 31.4056 },
  HRG: { lat: 27.1783, lon: 33.7994 }, SSH: { lat: 27.9773, lon: 34.395 },
  RMF: { lat: 25.5713, lon: 34.5837 }, RAK: { lat: 31.6069, lon: -8.0363 },
  CMN: { lat: 33.3675, lon: -7.59 }, JNB: { lat: -26.1392, lon: 28.246 },
  CPT: { lat: -33.969, lon: 18.6021 }, NBO: { lat: -1.3192, lon: 36.9278 },
  // Americas
  JFK: { lat: 40.6413, lon: -73.7781 }, EWR: { lat: 40.6895, lon: -74.1745 },
  LGA: { lat: 40.7769, lon: -73.874 }, LAX: { lat: 33.9416, lon: -118.4085 },
  SFO: { lat: 37.6213, lon: -122.379 }, ORD: { lat: 41.9742, lon: -87.9073 },
  MIA: { lat: 25.7959, lon: -80.287 }, BOS: { lat: 42.3656, lon: -71.0096 },
  YYZ: { lat: 43.6777, lon: -79.6248 }, YVR: { lat: 49.1967, lon: -123.1815 },
  MEX: { lat: 19.4361, lon: -99.0719 }, GRU: { lat: -23.4356, lon: -46.4731 },
  EZE: { lat: -34.8222, lon: -58.5358 },
  // Asia & Pacific
  SIN: { lat: 1.3644, lon: 103.9915 }, BKK: { lat: 13.69, lon: 100.7501 },
  HKT: { lat: 8.1132, lon: 98.317 }, DPS: { lat: -8.7482, lon: 115.1672 },
  KUL: { lat: 2.7456, lon: 101.7099 }, HKG: { lat: 22.308, lon: 113.9185 },
  NRT: { lat: 35.772, lon: 140.3929 }, HND: { lat: 35.5494, lon: 139.7798 },
  ICN: { lat: 37.4602, lon: 126.4407 }, DEL: { lat: 28.5562, lon: 77.1 },
  BOM: { lat: 19.0896, lon: 72.8656 }, SYD: { lat: -33.9399, lon: 151.1753 },
  MEL: { lat: -37.669, lon: 144.841 }, AKL: { lat: -37.0082, lon: 174.785 },
};

export function lookupAirport(code: string): AirportCoord | null {
  return AIRPORTS[code.trim().toUpperCase()] ?? null;
}
