# Fix: a Teramind pull fails when one response holds the same session twice

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/actions/…` means `actions/…`. Never create a top-level folder named `src`.**

## Files that may change

- `src/actions/upsertTeramindSessions.ts` — replace with the content below, character for character
- `src/app/pages/admin/teramind/TeramindTab.tsx` and `src/app/pages/admin/teramind/TeramindPullCard.tsx`
  — only for item 2 below

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`.

## What happened (on /dev, 2026-09-17)

"Backfill All Periods" saved 6,731 sessions and then stopped on Q1-Aug-2026 with:

> Can't execute upsertTeramindSessions action: [Code: 21000]: ON CONFLICT DO UPDATE command cannot
> affect row a second time

Teramind returned the same session (same agent, same start, same computer) twice inside one
200-row batch. Postgres will not update one row twice in a single `INSERT … ON CONFLICT`.

## 1. `upsertTeramindSessions.ts` — de-duplicate the batch in SQL

```ts
import { action } from '@uibakery/data';

// Saves Teramind login sessions. Teramind sometimes returns the same session twice in one
// response, and Postgres refuses to touch a row twice in one ON CONFLICT statement, so the batch
// is de-duplicated on the natural key first (keeping the longest duration).
function upsertTeramindSessions() {
  return action('upsertTeramindSessions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_sessions (
        agent_id, employee_id, work_date, started_et, finished_et, started_raw,
        duration_s, computer, raw, synced_at
      )
      SELECT DISTINCT ON ((r->>'agent_id')::bigint, r->>'started_raw', COALESCE(r->>'computer', ''))
        (r->>'agent_id')::bigint,
        ta.employee_id,
        r->>'work_date',
        r->>'started_et',
        r->>'finished_et',
        r->>'started_raw',
        COALESCE((r->>'duration_s')::int, 0),
        COALESCE(r->>'computer', ''),
        (r->'raw'),
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      LEFT JOIN teramind_agents ta ON ta.agent_id = (r->>'agent_id')::bigint
      ORDER BY (r->>'agent_id')::bigint, r->>'started_raw', COALESCE(r->>'computer', ''),
               COALESCE((r->>'duration_s')::int, 0) DESC
      ON CONFLICT (agent_id, started_raw, computer) DO UPDATE SET
        finished_et   = EXCLUDED.finished_et,
        duration_s    = EXCLUDED.duration_s,
        employee_id   = COALESCE(EXCLUDED.employee_id, teramind_sessions.employee_id),
        raw           = EXCLUDED.raw,
        synced_at     = NOW()
      RETURNING id;
    `,
  });
}

export default upsertTeramindSessions;
```

## 2. Pull Log table — keep it current and readable

- The Pull Log table must **refetch after every pull**, and after **each period** during a backfill
  (success or failure), so a failed period is visible immediately. Today it only loads once.
- Show the range as plain dates: `String(date_from).slice(0, 10)` → `String(date_to).slice(0, 10)`
  (the database layer hands date-looking text back as a full timestamp).
- A backfill must **continue with the next period** when one period fails, and finish with a plain
  summary: periods pulled, skipped (already covered), failed.

## Acceptance (check on /dev)

1. "Backfill All Periods" completes; Q1-Aug-2026 pulls without error.
2. The Pull Log shows one row per pulled period, ranges as `YYYY-MM-DD → YYYY-MM-DD`.
3. Running the backfill a second time skips every period.
4. Only the three files above changed.
