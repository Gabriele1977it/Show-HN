// Curated, ready-to-publish demo trips for onboarding a creator — so they have
// something great to share on day one without building it themselves. Content
// is deterministic and hand-written (no AI), themed around insider city guides.
// Dates are computed relative to "now" so the trips always read as recent.

export interface DemoItem {
  type: "flight" | "hotel" | "train" | "car" | "activity" | "other";
  title: string;
  dayIndex: number; // 0-based day within the trip
  hour: number; // local-ish hour, stored as UTC
  endDayIndex?: number;
  endHour?: number;
  location?: string | null;
  reference?: string | null;
}

export interface DemoExpense {
  category: "flights" | "lodging" | "meals" | "transport" | "entertainment" | "other";
  merchant: string;
  amount: string;
  currency: string;
  dayIndex: number;
  reimbursable: boolean;
}

export interface DemoTrip {
  title: string;
  destination: string;
  startDaysAgo: number; // trip start = today - startDaysAgo
  lengthDays: number;
  items: DemoItem[];
  expenses: DemoExpense[];
}

export const DEMO_TRIPS: DemoTrip[] = [
  {
    title: "Lisbon in 4 Days",
    destination: "Lisbon, Portugal",
    startDaysAgo: 66,
    lengthDays: 4,
    items: [
      { type: "flight", title: "TAP TP1359 LHR → LIS", dayIndex: 0, hour: 8, endHour: 11, location: "London Heathrow", reference: "TP1359" },
      { type: "hotel", title: "The Lumiares — Bairro Alto", dayIndex: 0, hour: 14, endDayIndex: 3, endHour: 11, location: "Bairro Alto, Lisbon" },
      { type: "activity", title: "Sunset at Miradouro da Senhora do Monte", dayIndex: 0, hour: 19, location: "Graça, Lisbon" },
      { type: "activity", title: "Tram 28 through Alfama", dayIndex: 1, hour: 10, location: "Alfama, Lisbon" },
      { type: "activity", title: "Belém — Jerónimos & Pastéis de Belém", dayIndex: 1, hour: 15, location: "Belém, Lisbon" },
      { type: "activity", title: "Day trip to Sintra — Pena Palace", dayIndex: 2, hour: 9, location: "Sintra" },
      { type: "activity", title: "Dinner at Time Out Market", dayIndex: 2, hour: 20, location: "Cais do Sodré, Lisbon" },
      { type: "flight", title: "TAP TP1358 LIS → LHR", dayIndex: 3, hour: 13, endHour: 16, location: "Lisbon Airport", reference: "TP1358" },
    ],
    expenses: [
      { category: "flights", merchant: "TAP Air Portugal", amount: "148.00", currency: "GBP", dayIndex: 0, reimbursable: false },
      { category: "lodging", merchant: "The Lumiares", amount: "540.00", currency: "EUR", dayIndex: 0, reimbursable: false },
      { category: "entertainment", merchant: "Pena Palace tickets", amount: "40.00", currency: "EUR", dayIndex: 2, reimbursable: false },
      { category: "meals", merchant: "Time Out Market", amount: "62.00", currency: "EUR", dayIndex: 2, reimbursable: false },
      { category: "transport", merchant: "Sintra train + tuk-tuk", amount: "34.00", currency: "EUR", dayIndex: 2, reimbursable: false },
    ],
  },
  {
    title: "Tokyo: A First-Timer's Guide",
    destination: "Tokyo, Japan",
    startDaysAgo: 34,
    lengthDays: 6,
    items: [
      { type: "flight", title: "ANA NH212 LHR → HND", dayIndex: 0, hour: 11, endDayIndex: 1, endHour: 8, location: "London Heathrow", reference: "NH212" },
      { type: "hotel", title: "Shinjuku Granbell Hotel", dayIndex: 1, hour: 11, endDayIndex: 5, endHour: 10, location: "Shinjuku, Tokyo" },
      { type: "activity", title: "Shibuya Crossing & Hachiko at dusk", dayIndex: 1, hour: 18, location: "Shibuya, Tokyo" },
      { type: "activity", title: "Senso-ji Temple, Asakusa", dayIndex: 2, hour: 9, location: "Asakusa, Tokyo" },
      { type: "activity", title: "teamLab Planets", dayIndex: 2, hour: 15, location: "Toyosu, Tokyo" },
      { type: "activity", title: "Tsukiji Outer Market breakfast", dayIndex: 3, hour: 8, location: "Tsukiji, Tokyo" },
      { type: "activity", title: "Day trip to Hakone — Mt Fuji views", dayIndex: 4, hour: 9, location: "Hakone" },
      { type: "flight", title: "ANA NH211 HND → LHR", dayIndex: 5, hour: 12, endHour: 17, location: "Tokyo Haneda", reference: "NH211" },
    ],
    expenses: [
      { category: "flights", merchant: "ANA", amount: "712.00", currency: "GBP", dayIndex: 0, reimbursable: false },
      { category: "lodging", merchant: "Shinjuku Granbell", amount: "68000", currency: "JPY", dayIndex: 1, reimbursable: false },
      { category: "entertainment", merchant: "teamLab Planets", amount: "3800", currency: "JPY", dayIndex: 2, reimbursable: false },
      { category: "transport", merchant: "Hakone Free Pass", amount: "6100", currency: "JPY", dayIndex: 4, reimbursable: false },
      { category: "meals", merchant: "Tsukiji + izakaya nights", amount: "24000", currency: "JPY", dayIndex: 3, reimbursable: false },
    ],
  },
];
