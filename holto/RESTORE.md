# HOLTO — database backup & restore runbook

> "If you haven't done a restore, you don't have backups — you have hope."

HOLTO's data lives in a **managed PostgreSQL** database on Render, which takes
**automatic daily backups**. Automatic backups are worthless until you've
actually restored one, so this is the drill to prove it works — **before** you
ever need it in anger.

**Do this once now, then quarterly, and after any big schema change.** It takes
~15 minutes and never touches production.

---

## What you have

- **Render automatic backups** — daily, on the database's **Backups / Recovery**
  tab in the Render dashboard. Retention depends on your Postgres plan (paid
  plans also offer point-in-time recovery).
- Everything else (code, config) is in Git + Render env vars, so the database is
  the only thing that can't be rebuilt from scratch.

You'll need the Postgres client tools locally: `pg_dump`, `pg_restore`, `psql`
(install `postgresql` / `libpq`).

---

## The drill (safe — never writes to production)

### 1. Take a fresh logical backup from production

This is read-only and safe to run against the live database. Get the
**External Database URL** from Render → your Postgres → *Connect*.

```bash
export PROD_URL="postgresql://…the external prod URL…"
pg_dump "$PROD_URL" -Fc -f holto-backup.dump
```

*(Or download the latest daily backup file from the Render Backups tab instead of
running `pg_dump` — either works as the source.)*

### 2. Create a throwaway "scratch" database to restore INTO

**Never restore into production.** Restore into a fresh database:

- **Option A — Render:** create a new (free/cheap) Postgres instance; copy its
  External URL.
- **Option B — local:** `createdb holto_restore_test`

```bash
export SCRATCH_URL="postgresql://…the scratch URL…"
```

### 3. Restore the backup into the scratch database

```bash
pg_restore --no-owner --no-privileges --clean --if-exists -d "$SCRATCH_URL" holto-backup.dump
```

### 4. Verify it actually restored (this is the whole point)

```bash
psql "$SCRATCH_URL" -c "\dt"                          # tables are present
psql "$SCRATCH_URL" -c "SELECT count(*) FROM users;"  # real rows, not zero
psql "$SCRATCH_URL" -c "SELECT count(*) FROM trips;"
psql "$SCRATCH_URL" -c "SELECT max(created_at) FROM users;"  # data is recent
```

✅ **Pass** = tables exist, counts are non-zero, and the newest timestamp is
close to when you took the backup. If so, your backups are real.

### 5. Clean up

Delete the scratch Render database (or `dropdb holto_restore_test`) and the local
`holto-backup.dump`.

---

## Real emergency restore (production is lost/corrupted)

1. In Render → Postgres → **Backups / Recovery**, restore the most recent good
   backup (paid plans: pick the point in time *before* the incident). This
   produces a restored database.
2. Copy the restored database's connection string.
3. Update **`DATABASE_URL`** on **both** the `holto-api` web service **and** the
   monitor worker (if separate), then trigger a redeploy.
4. Confirm `/api/healthz` is green and spot-check the app (log in, list trips).
5. Rotate any secrets if the incident could have exposed them.

> The app reconciles its own schema on boot (`ensure-schema.ts`), so a restored
> database of an older shape self-heals missing columns on the next deploy.

---

## Cadence

- ☑️ **Now** — run the drill once to confirm backups are restorable.
- ☑️ **Quarterly** — repeat; note the date + row counts somewhere.
- ☑️ **After any major schema change** — confirm a restore still verifies.
