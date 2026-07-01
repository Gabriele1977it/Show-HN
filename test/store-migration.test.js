import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqliteStore } from "../server/store-sqlite.js";

// Regression: opening a database created before the marketplace/analytics
// columns existed must migrate cleanly. This used to crash on boot with
// "SqliteError: no such column: listed" because the index was declared in the
// schema block (run before the ALTER migration that adds the column).
test("opening a pre-marketplace database migrates it without crashing", () => {
  const dir = mkdtempSync(join(tmpdir(), "echodeck-mig-"));
  const path = join(dir, "old.db");

  // Seed an older-shape decks table (no listed/description/installs/views).
  const seed = new Database(path);
  seed.exec(
    "CREATE TABLE decks (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT, " +
    "language TEXT, audio_url TEXT, created_at INTEGER, share_id TEXT UNIQUE);",
  );
  seed.prepare("INSERT INTO decks (id,workspace_id,title,created_at) VALUES (?,?,?,?)")
    .run("d1", "w1", "Old deck", Date.now());
  seed.close();

  // Previously threw here; now it migrates the existing database in place.
  const store = createSqliteStore(path);
  const cols = new Set(store._db().prepare("PRAGMA table_info(decks)").all().map((c) => c.name));
  for (const c of ["listed", "listed_at", "description", "installs", "views"]) {
    assert.ok(cols.has(c), `migrated column present: ${c}`);
  }

  // The pre-existing row survives and reads back with sensible defaults.
  const deck = store.getDeck("d1", "w1");
  assert.equal(deck.title, "Old deck");
  assert.equal(deck.listed, false);
  assert.equal(deck.installs, 0);
  assert.equal(deck.views, 0);

  store.close();
  rmSync(dir, { recursive: true, force: true });
});
