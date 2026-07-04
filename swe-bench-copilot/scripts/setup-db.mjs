// scripts/setup-db.mjs
// One-time database setup: creates the `tasks` table in your Aiven Postgres.
// Run with:  npm run db:setup
// It reads DATABASE_URL from .env.local so you never paste the URL twice.

import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

// Minimal .env.local loader (Node scripts don't read it automatically).
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL is not set. Add it to .env.local first (see README step 4)."
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      issue_url TEXT,
      status TEXT DEFAULT 'pending',
      agent_diff TEXT,
      tests_passed INT DEFAULT 0,
      tests_failed INT DEFAULT 0,
      code_quality TEXT,
      project_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM tasks");
  console.log(`✅ Database ready — 'tasks' table exists (${rows[0].n} rows).`);
} catch (err) {
  console.error("❌ Could not set up the database:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
