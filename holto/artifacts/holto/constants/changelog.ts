// In-app "What's new" content. Newest entry first. `id` is a stable key we
// store once the user has seen it, so the sheet only auto-opens on a genuinely
// new release. Keep entries short and user-facing (benefits, not internals).

export interface ChangelogItem {
  emoji: string;
  text: string;
}

export interface ChangelogEntry {
  id: string; // stable, e.g. "2026-07-13"
  title: string;
  date: string; // display date
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-07-13",
    title: "News, auto-import & more",
    date: "July 2026",
    items: [
      { emoji: "📰", text: "New Live News tab — world & travel headlines, with a Disruptions filter that flags strikes, airspace and weather that could affect your trip. Works offline too." },
      { emoji: "🏆", text: "Auto-import your loyalty balances from AwardWallet — every card in your wallet without the typing." },
      { emoji: "✈️", text: "A morning \"your travel day\" nudge on days you're flying, so nothing is a surprise." },
      { emoji: "🧭", text: "Offline destination guide on your travel day — emergency numbers, plugs, tap water and tipping." },
      { emoji: "🔑", text: "Forgot your password? You can now reset it yourself from the sign-in screen." },
    ],
  },
];

export const LATEST_CHANGELOG_ID = CHANGELOG[0]?.id ?? "";
