// Deck exporters.
//
// Creators need to get their study material out of EchoDeck and into the tools
// their audience already uses (Anki, spreadsheets, custom pipelines).

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Anki-friendly tab-separated values: front \t back \t tags. No header. */
export function toAnkiTsv(cards) {
  return cards
    .map((c) => {
      const front = (c.front ?? "").replace(/\t|\n/g, " ").trim();
      const back = (c.back ?? "").replace(/\t|\n/g, " ").trim();
      const tags = (c.tags ?? []).join(" ");
      return [front, back, tags].join("\t");
    })
    .join("\n");
}

/** Spreadsheet-friendly CSV with a header row. */
export function toCsv(cards) {
  const header = ["front", "back", "notes", "start", "end", "tags"];
  const rows = cards.map((c) =>
    [
      c.front,
      c.back,
      c.notes,
      c.start ?? "",
      c.end ?? "",
      (c.tags ?? []).join(" "),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Full fidelity JSON (cards + timing + SRS state). */
export function toJson(deck, cards) {
  return JSON.stringify(
    {
      title: deck.title,
      language: deck.language,
      audioUrl: deck.audioUrl,
      exportedAt: new Date().toISOString(),
      cards: cards.map((c) => ({
        front: c.front,
        back: c.back,
        notes: c.notes,
        start: c.start,
        end: c.end,
        tags: c.tags,
        srs: c.srs,
      })),
    },
    null,
    2,
  );
}

export function exportDeck(deck, cards, format) {
  switch ((format || "json").toLowerCase()) {
    case "anki":
    case "tsv":
      return { body: toAnkiTsv(cards), type: "text/tab-separated-values", ext: "tsv" };
    case "csv":
      return { body: toCsv(cards), type: "text/csv", ext: "csv" };
    case "json":
    default:
      return { body: toJson(deck, cards), type: "application/json", ext: "json" };
  }
}
