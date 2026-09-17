# FROZEN CONTRACT — Teramind saved copy (do not change names or shapes)

House rules for every file you write:
- Pure libs live in `src/app/lib/`, have ZERO runtime imports (`import type` only), stay under 12 KB,
  and start with a 3-6 line plain-English header comment saying what the file is for.
- Tests live in `tests/`, use `node:test` + `node:assert/strict`, import libs with a relative path
  INCLUDING the `.ts` extension (e.g. `'../src/app/lib/teramindTime.ts'`), and are run from the
  folder that contains `src/` and `tests/` with:  node --test "tests/*.test.ts"   (Node 24, native
  type stripping: no enums, no namespaces, no parameter properties, no path aliases).
- Dates are `YYYY-MM-DD` strings compared as strings. NEVER `toISOString().slice(0,10)`.
  NEVER `new Date('YYYY-MM-DD')` for date math — use `Date.UTC(y, m-1, d)` on parsed integers.
- All clock text is US-Eastern wall-clock, format exactly `YYYY-MM-DD HH:MM:SS` (24h, zero-padded,
  NO `T`, NO `Z`, NO offset). Payroll code downstream REFUSES any string matching
  /Z$/i  or  /[T ]\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:?\d{2})/ .

## Types (file: src/app/lib/teramindTypes.ts — types only, already written, import type from it)

See `src/app/lib/teramindTypes.ts` in this folder.

## Tables (Postgres)

teramind_agents   (agent_id BIGINT PK, employee_id BIGINT NULL -> employees(id), email TEXT, name TEXT,
                   deleted BOOLEAN NOT NULL DEFAULT false, linked_by TEXT, raw JSONB, synced_at TIMESTAMPTZ)
teramind_sessions (id identity PK, agent_id BIGINT NOT NULL, employee_id BIGINT NULL -> employees(id),
                   work_date TEXT NOT NULL, started_et TEXT NOT NULL, finished_et TEXT NOT NULL,
                   started_raw TEXT NOT NULL, duration_s INT NOT NULL DEFAULT 0, computer TEXT NOT NULL DEFAULT '',
                   raw JSONB, synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                   UNIQUE (agent_id, started_raw, computer))
teramind_pull_log (id identity PK, date_from TEXT, date_to TEXT, pulled_at TIMESTAMPTZ DEFAULT NOW(),
                   pulled_by TEXT, trigger TEXT, agent_count INT, row_count INT, saved_count INT,
                   truncated BOOLEAN DEFAULT false, error TEXT)
