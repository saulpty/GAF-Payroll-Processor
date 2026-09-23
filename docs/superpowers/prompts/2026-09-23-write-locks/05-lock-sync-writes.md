# 05 — Lock the Monday and Teramind sync change-data actions

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these 14 files may change. No other file may be touched.**

- `src/actions/claimSyncRun.ts`
- `src/actions/upsertSyncLog.ts`
- `src/actions/upsertMondaySyncLog.ts`
- `src/actions/upsertMondayAttendanceForms.ts`
- `src/actions/upsertMondayContracts.ts`
- `src/actions/upsertMondayRequests.ts`
- `src/actions/updateMondayAttendanceFormsDeleted.ts`
- `src/actions/updateMondayContractsDeleted.ts`
- `src/actions/updateMondayRequestsDeleted.ts`
- `src/actions/upsertTeramindAgents.ts`
- `src/actions/upsertTeramindPullLog.ts`
- `src/actions/upsertTeramindSessions.ts`
- `src/actions/updateTeramindAgentLink.ts`
- `src/actions/updateTeramindAgentLinks.ts`

## Why

These are written by the background syncs, which run only in a super user's browser, and by the Admin sync buttons. A manager's browser no longer runs them; now the database refuses them too.

## The rule — apply it to every file listed, and change nothing else

Add the lock `public.assert_super({{ user.email }}::text)` to **every** INSERT, UPDATE and DELETE
statement in each file. Write it exactly like that: `{{ user.email }}` (the real signed-in person —
never `viewAs`), with `::text`, and never inside quotes.

1. **UPDATE / DELETE** — add `AND public.assert_super({{ user.email }}::text)` to the end of the
   `WHERE`. If the statement has no `WHERE`, add `WHERE public.assert_super({{ user.email }}::text)`
   (before any `RETURNING`).
2. **INSERT … VALUES (…)** — change `VALUES (a, b, c)` to
   `SELECT a, b, c WHERE public.assert_super({{ user.email }}::text)`. Keep the column list, every
   expression, every cast and their order exactly as they are, and keep `ON CONFLICT …` and
   `RETURNING …` unchanged after it. Example:
   ```sql
   -- before
   INSERT INTO holidays (holiday_date, name) VALUES ({{params.date}}, {{params.name}})
   ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name;
   -- after
   INSERT INTO holidays (holiday_date, name)
   SELECT {{params.date}}, {{params.name}} WHERE public.assert_super({{ user.email }}::text)
   ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name;
   ```
3. **INSERT … SELECT …** (including `jsonb_to_recordset` batches) — add
   `AND public.assert_super({{ user.email }}::text)` to that SELECT's own `WHERE`, or add a
   `WHERE` with it if there is none. It goes after `FROM` and before any `GROUP BY`,
   `ORDER BY` or `ON CONFLICT`.
4. **`WITH x AS (UPDATE …)`** — every data-changing statement inside the `WITH` gets the lock in
   its own `WHERE` too, not only the main statement.
5. **Several statements in one action** — each statement gets the lock.

Do not change anything else in any file: not the `{{params.…}}`, not the casts, not the conflict
targets, not the `RETURNING` lists, not the formatting of lines you are not editing. **Do not run
any of these actions** — they write to the live database. The lock function
`public.assert_super(text)` already exists (previous round).

## Acceptance

- Every INSERT, UPDATE and DELETE statement in each listed file contains `public.assert_super({{ user.email }}::text)`, and no listed file still contains `VALUES (`.
- Nothing else in any file changed. Only the listed files changed.
