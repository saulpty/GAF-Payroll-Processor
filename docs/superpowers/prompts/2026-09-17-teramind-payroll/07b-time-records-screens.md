# 07b — Pull from Time Records; comparison screen picks its source; split the big file

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…`. Never create a top-level folder named `src`.**

## Files that may change

- `src/app/pages/admin/teramind/useTeramindPull.ts`
- `src/app/pages/admin/teramind/TeramindPullCard.tsx`
- `src/app/pages/admin/teramind/TeramindTab.tsx`
- `src/app/pages/admin/teramind/TeramindAgentsCard.tsx`
- `src/app/pages/admin/teramind/TeramindCompare.tsx`
- `src/app/pages/admin/teramind/TeramindCompareTable.tsx` — NEW

No other file may be touched. Do not modify any file under `src/app/lib/` or `src/actions/` — the
previous prompt (07a) already put the libs and actions in place. Never edit `ProcessPayroll.tsx`,
`PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`,
`teramindParser.ts`, or anything under `src/components/ui/`.

## 1. `useTeramindPull.ts` — `pullRange` reads the Time Records feed

Keep `syncAgents` exactly as it is. Rewrite the body of `pullRange(from, to, trigger)`:

1. Linked agents as today: `loadTeramindAgents({})` → rows with non-null `employee_id` →
   `agentIds: number[]`. None → throw the same plain message, before calling Teramind.
2. `const { periodStart, periodEnd } = recordWindow(from, to)` from `teramindPull.ts`.
3. Page loop, `page = 0, 1, 2 …`, at most 40 pages: call
   `loadTeramindTimeRecords({ agents: agentIds, page, pageSize: 5000, periodStart, periodEnd })`
   (**`agents` is passed as a real array, not a string**). The response is an object; its rows are
   `resp.rows` (use `unwrapRows(resp)`, which already understands `{ rows: [...] }`). Add the row
   count to `fetched`. Stop when `resp?.pagination?.next !== true` or the page returned 0 rows.
   If the loop stops because it hit 40 pages, set `truncated = true`.
4. For each row: `normalizeTimeRecord(row, sessionClock)` from `teramindRows.ts`. Drop (count in
   `dropped`) when it returns null, when its `agent_id` is not in the linked set, or when
   `!inDateRange(session.work_date, from, to)` (the window is deliberately one day wider than the
   dates — trimming it back here is required).
5. Save in chunks of 200 through `upsertTeramindSessions`, each row:
   `agent_id, work_date, started_et, finished_et, started_raw, duration_s, computer,
   source: 'time_record', is_manual, raw: <the original row>`.
6. One `upsertTeramindPullLog` per call, success or failure, exactly as today, plus
   `source: 'time_record'`.

Remove the import of `loadTeramindLoginSessions`, `pullChunks` and `isTruncated` from this file if
nothing uses them any more. All time conversion still goes through `sessionClock` only.

## 2. `TeramindPullCard.tsx` and `TeramindTab.tsx`

- "Already covered" must only count pulls from the new feed: pass `coversRange` only log rows with
  `source === 'time_record'` and no error. (Every period will therefore pull again once — intended.)
- Card title: **Pull Time Records**. The Backfill button stays **disabled until the period list has
  loaded** (today a click before that reports "0 periods").
- Pull Log table: add a **Source** column (`Time Records` / `Login Sessions`).
- Replace the footer note with: "Time Records are live — today's records are available now."

## 3. `TeramindAgentsCard.tsx`

The "Linked Employees" tile must count **distinct employees** that have at least one linked agent
(today it counts agents, so it reads 46 for 45 people). Under the tiles add one muted line when any
employee has more than one agent: "N employee(s) have more than one Teramind account — all of their
accounts are linked."

## 4. `TeramindCompare.tsx` + new `TeramindCompareTable.tsx`

`TeramindCompare.tsx` is 15.8 KB — over the 15 KB limit. Move the table (header, rows, Δ colouring,
chips, the 500-row cap note) into `TeramindCompareTable.tsx` with props
`{ rows: { row: CompareRow; verdict: CompareVerdict }[]; totalCount: number }`. Both files must end
up under 12 KB. No behaviour change from the split itself.

Then add:
- A **Source** toggle next to the period select: **Time Records** (default) | **Login Sessions**,
  passed flat to the action as `source: 'time_record' | 'login_session'`.
- `has_manual` from the action (map with `=== true`): show a small chip **manual** in the Sessions
  cell when true, and add a **Manual Time Only** filter chip. Add `manual` to the CSV.
- Rename the column header "Sessions" to "Records".

## Rules

Every file under 15 KB · `useLoadAction` / action params always **flat** · dates are `YYYY-MM-DD`
strings compared as strings, never `new Date(str)` for date math, never `toISOString().slice(0,10)`
· no hardcoded ids, URLs or the string `teramind.co` · Title Case labels · this tab never writes to
`payroll_entries`.

## Acceptance (check on /dev)

1. Pull 2026-08-10 → 2026-08-24: the log row says Source = Time Records, saved is a few thousand,
   nothing from outside those dates is saved.
2. "Backfill All Periods" pulls all 12 periods once; a second click skips all 12.
3. Comparison, Q2-Aug-2026, Source = Time Records: Elizabeth Mootoo 2026-08-11 is a Match
   (8:56 AM / 5:01 PM on both sides).
4. Linked Employees reads 45.
5. Only the six files above changed; `TeramindCompare.tsx` and `TeramindCompareTable.tsx` are under 12 KB.
