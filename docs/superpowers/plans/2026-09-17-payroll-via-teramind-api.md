# Plan — Payroll punches straight from the Teramind API (no more file uploads)

## Context

Today Tim opens **Process Payroll**, types the period (name + start + end), downloads a report
from Teramind, uploads it, and clicks Run. The app reads only three things from that file — who,
time started, time finished (one row per login session) — and keeps the earliest start / latest
finish per person per day as entry / exit. The file is never saved (only its first 100 rows).

Saul wants the same information to arrive **directly from the Teramind API**. Periods (cortes de
planilla) stay exactly as they are: Tim still creates each one with its dates, works it in Action
Required / Payroll Master, and exports the HRK summary. Only the *source of the punches* changes.

Decisions made with Saul (2026-09-17):
- **File upload stays as a backup** under the new "Pull from Teramind" button.
- **Proof = look backwards.** Pull Teramind for **all past periods** and compare against what is
  already in the database. If it matches, switch going forward — no parallel-run period needed.
- **Everything pulled is saved in our database**, so a period is pulled from Teramind once and
  afterwards read from our own copy (fast, permanent audit trail, and it is exactly what the parked
  Activity feature will read later).
- **Live data + captured periods (Saul, 2026-09-17, later the same day).** The Hub should be as
  live as possible everywhere: Teramind flows into our saved copy continuously, and Attendance
  (and later Activity) read it without waiting for a payroll run. A **period is a capture**: when Tim
  creates the period, the app takes the saved punches for those dates (after one fresh sync), runs the
  rules engine, and writes `payroll_entries` — the frozen, workable copy he reviews and sends to HRK.
  Live data arriving afterwards never changes a captured period unless Tim deliberately re-captures.
  `payroll_entries` **is** the capture; no new "period" machinery is needed.
- Past periods are **not re-processed**. Their payroll rows stay as they are.
- Keep it tight: re-run behaviour, Action Required, Payroll Master, HRK Summary, the rules engine
  and the file parser are **not changed**.

When periods are run today (Period Log on `/dev`, read 2026-09-17): the last four periods were
processed **the day after the period ended** (e.g. Q2-Aug ends 08-24 → run 08-25 14:24; Q1-Aug ends
08-09 → run 08-10). Older ones (Mar–Jun) were run **on the last day itself** (e.g. Q2-Jun ends
06-25 → run 06-25 20:11), which is what the "export pulled mid-day" checkbox exists for. HRK exports
happen the same or next day, sometimes twice. Recommended habit with the API: run the morning after
the period ends — the pull is then complete and the mid-day checkbox is not needed.

What the research found (shapes the design):
- Teramind's `login_session` feed (agent, timestamp, duration, computer) is the same shape as the
  uploaded report, so the existing fold (earliest start / latest finish per start-date) can be fed
  unchanged. `processTeramindData` and `runClassificationEngine` stay untouched.
- The app **refuses any timestamp carrying a timezone** (deliberately — a wrong hour moves money).
  The API will likely send one. The conversion to US-Eastern clock text happens in **one tested
  lib**, before anything reaches the payroll code.
- Some people appear in Teramind under more than one agent (MacBook hostnames). The link must be
  **many agents → one employee**, so a link table, not a single column on `employees`.
- `ProcessPayroll.tsx` is 57 KB and protected. It gets the **smallest possible edit, last**, after
  everything else is proven. Guard L4 requires exactly 14 `cfgGet` fallbacks in it — we add none.
- There is no test on the file parser today; every engine test builds the punches map by hand. So
  the swap breaks no test — and the new converter gets its own tests.

## Probe outcome (2026-09-17 — full detail in `prompts/2026-09-17-teramind-payroll/00-probe-RESULTS.md`)

- Datasource string `'Teramind API'`. All **45 active employees match exactly one agent** by email.
- Sessions arrive as a bare array; `agent` = `[id, name, email]`, `computer` = `[id, name]`,
  `timestamp` = ISO with the Eastern offset. **Smell test matched payroll to the minute**
  (API 08:56:56 → 17:01:16 vs payroll 8:56 AM → 5:01 PM).
- The cube **cannot be filtered by agent** → pull the company for the range (~500 rows/day, 7,384 for
  a 15-day period, cap is 50,000), keep only linked agents before saving.
- History reaches back past Sep 2025 → **every past period can be compared**.
- **Teramind is not live through this API: both cubes are complete through *yesterday* and empty
  for today.** Only the `online` flag on the roster is real-time. So "as live as possible" = through
  yesterday for arrival/exit, plus who is online now. The keep-fresh sync needs to run once each
  morning, not every 15 minutes. A period can be captured from the API from the morning after it
  ends; a same-day run still needs the uploaded file (the backup stays for exactly that).
- **~6% of company sessions are absurdly long** (up to exactly 8 days — machines never logged out).
  The uploaded report must have met the same sessions; Phase C shows how they landed in payroll
  before any capping rule is chosen.
- UIB has server-side **Automations** (timer, no browser) — candidate for the morning sync; lives
  outside the export/diff loop, so decide after the in-app sync works.
- Built and green in `prompts/2026-09-17-teramind-payroll/build/`: 4 libs + types (72 tests),
  migration, 8 SQL actions, 2 HTTP actions. Not yet sent to UIB.

## Build order — payroll is touched only in Phase D

```
Phase 0  Park the Activity plan + save research (docs only)                          DONE 2026-09-17
Phase A  Probe the API (no app files change)
Phase B  Foundation: saved copy + agent links + pull + KEEP-FRESH sync                 (no payroll file touched)
Phase C  Backfill all past periods → comparison screen → review with Saul             ← GATE
Phase D  Process Payroll step 2: "Capture from Teramind" (upload stays as backup)      (only payroll edit)
Phase E  Live Attendance: days not yet captured come from the saved copy, marked Live  (no payroll file touched)
Phase F  Docs, handoff; then re-plan Activity on top of the same live copy
```

### Phase 0 — park and save (docs only, first commit)
1. Save the parked Activity plan as `docs/superpowers/plans/2026-09-17-activity-monitoring-PARKED.md`.
2. Write `docs/findings/2026-09-17-vp-work-pattern-monitor-and-teramind-api.md` (VP app endpoints,
   bodies, response shapes, formulas, feature inventory, bare-verdict spots, repo traps).
3. Write `docs/findings/2026-09-17-payroll-upload-pipeline.md` (today's upload pipeline, the
   parser↔engine contract, period lifecycle, re-run semantics, risks — from this session).
4. Save this plan as `docs/superpowers/plans/2026-09-17-payroll-via-teramind-api.md`. Commit.

### Phase A — probe (prompt `00-probe.md`, folder `docs/superpowers/prompts/2026-09-17-teramind-payroll/`)
House format of `2026-09-07-disciplinary/02c-probe-datasource-name.md`. If an action file is needed,
one throwaway `src/actions/zzProbeTeramind.ts`, deleted by `00z`. Results → `00-probe-RESULTS.md`.
1. Exact datasource display name for `datasourceName`.
2. `/v1/agents`: which field is the email; does it equal `employees.teramind_email`; how many
   agents per Panama employee; are deleted/old agents returned.
3. `login_session` cube: timestamp format (UTC `Z`? offset? already Eastern?), is `time_s` the
   session length, does an agent `in:[…]` filter work (VP says it returns 0 rows — may be a
   serialization bug), what does a still-open session look like.
4. **How far back does the API go?** (decides how many past periods Phase C can check.)
5. Row counts for one 15-day period vs the 50,000 cap.
6. One employee × 3 known days: API earliest start / latest finish vs `payroll_entries`
   entry/exit — a first smell test before building anything.

Gates: **G-TZ** lock the conversion rule from the real timestamp format. **G-FILTER** if sessions
can't be filtered by agent, the pull fetches the range and keeps only linked Panama agents before
saving (acceptable: only super users can pull; nothing unfiltered is ever stored or shown).

### Phase B — foundation (new files only; zero payroll files)
**Migration** `src/migrations/<ts>_teramind_saved_copy.sql` (idempotent, rollback stated):
- `teramind_agents` — `agent_id BIGINT PK, employee_id BIGINT NULL REFERENCES employees, email TEXT,
  name TEXT, deleted BOOLEAN, linked_by TEXT, synced_at`. Many agents → one employee.
- `teramind_sessions` — `agent_id, employee_id, work_date TEXT` (Eastern date of the session
  **start** — same rule as `tests/crossMidnight.test.ts`), `started_et TEXT`, `finished_et TEXT`
  (Eastern clock text `YYYY-MM-DD HH:MM:SS`, no timezone — what the payroll code requires),
  `started_raw TEXT`, `duration_s INT`, `computer TEXT`, `raw JSONB`, `synced_at`;
  `UNIQUE (agent_id, started_raw, computer)`. Rows are never deleted (Monday-mirror convention).
- `teramind_pull_log` — `id, date_from, date_to, pulled_at, pulled_by, agent_count, row_count,
  truncated BOOLEAN, error TEXT` (audit + "last pulled" display).
- View `v_teramind_vs_payroll` — per employee per day: saved-copy earliest start / latest finish vs
  `payroll_entries.entry_time / exit_time` (latest period, `deleted_at IS NULL`), difference in
  minutes each side, plus `updated_at > created_at` as a "Tim may have edited this" hint.

**Actions** (each < 1 KB; model `pullMondayBoard.ts` — object body, whole `{{params.x}}`, never
quoted; SQL upserts modelled on `upsertMondayRequests.ts` with `jsonb_array_elements`):
`loadTeramindAgentDirectory` (HTTP), `loadTeramindLoginSessions` (HTTP, date range [+ agent ids per
G-FILTER]), `upsertTeramindAgents`, `updateTeramindAgentLink`, `upsertTeramindSessions`,
`upsertTeramindPullLog`, `loadTeramindAgents`, `loadTeramindPullLog`,
`loadTeramindSessions` (date range; **viewer-scoped** via `v_employee_access` + optional `manager`
param, added to `SCOPED_ACTIONS` — so Activity can reuse it later), `loadTeramindVsPayroll`.

**Pure libs** (`src/app/lib/`, zero runtime imports, developed test-first in the scratchpad, pasted
verbatim into the prompt, diffed after sync):
- `teramindTime.ts` — the **only** place a timezone conversion exists: instant → Eastern
  `{date, 'YYYY-MM-DD HH:MM:SS'}` via `Intl` `America/New_York`. Never slices a date off an
  offset-bearing string (the VP app's bug).
- `teramindRows.ts` — `agentIdOf` (handles `[42]`, `[{id}]`, scalar), response unwrapping (bare
  array or `{data:[…]}`), agent↔employee email matching (lower-cased).
- `teramindPunches.ts` — saved sessions → `TeramindRawRow[]` (`email` = lower-cased
  `teramind_email`, `timeStarted`, `timeFinished`) — **byte-compatible with what the file parser
  hands to `processTeramindData`**, so nothing downstream changes.
- `teramindPull.ts` — splits a date range into ≤7-day chunks, always extends the end by one day
  (cross-midnight exits), reports truncation.

**UI** (super-only, Admin → Employees → a new **Teramind** tab next to Monday; reuse
`MondaySyncCard` as the progress/error shell): `TeramindTab.tsx`, `TeramindAgentsCard.tsx` (sync
roster; Linked / Unlinked counts; list of active employees with **no** linked agent and a dropdown
to link one by hand), `TeramindPullCard.tsx` (pick a period or dates → pull → save → log row),
`useTeramindPull.ts` (the pull-and-save routine — **written once, reused by Process Payroll in
Phase D**). Wiring: the one Admin file that lists the tabs. Not `AdminLookups.tsx`.

**Keeping the copy fresh (the "live" part).** The probe asks whether this UIB instance can run an
action on a schedule with no browser open. If yes: a scheduled sync every ~15 min pulling *today and
yesterday* (Eastern). If no: the Monday pattern — `TeramindAutoSync.tsx` mounted in `app.tsx`
beside `AccessAutoSync`, **super users only**, throttled (default 15 min, setting
`teramind_sync_every_minutes` in `classification_config`), in-flight guard, success *and* failure
written to `teramind_pull_log`; plus a **Refresh now** button. Managers never trigger a pull (an
unfiltered pull would put the whole company in their browser) — they read the saved copy, which is
viewer-scoped in SQL. Every live screen shows **"Teramind data as of <time>"** so nobody mistakes a
stale copy for a missing person. Honest limit: without a scheduler, data is only as fresh as the last
time a super user had the Hub open.

### Phase C — look backwards (the gate)
1. From the Teramind tab, **Backfill**: loop every period in `periods` (as far back as the probe
   says the API goes), pull and save each. Progress + per-period result in `teramind_pull_log`.
2. `TeramindCompare.tsx` (same tab): per period — days compared, exact matches, within 1 min,
   different; then the list of differences (employee, date, payroll entry/exit, Teramind
   entry/exit, minutes apart, "possibly hand-edited" hint, "no Teramind data" / "no payroll row").
3. Saul and I review it together with screenshots. Expected honest differences: days Tim
   hand-corrected, outage days, people processed under a name alias, phantom off-day rows
   (BACKLOG #13). Anything else is a defect to explain **before** Phase D.
4. Write the result to `docs/findings/<date>-teramind-api-vs-past-periods.md`. **Saul decides go /
   no-go.** Nothing in `payroll_entries` is changed by this phase.

### Phase D — Process Payroll (the only protected-file edit; Saul has asked for this revamp)
One prompt, two files allowed: new `src/app/pages/process/TeramindSourceCard.tsx` and
`ProcessPayroll.tsx`. Exact touch points in `ProcessPayroll.tsx` (nothing else):
- Step 2 renders `<TeramindSourceCard>`: **Capture from Teramind** for the Step-1 dates — always
  does one fresh sync of that range first, then reads the saved copy
  (uses `useTeramindPull` → saves → reads the saved copy → `teramindRows` via `teramindPunches`).
  If that range is already saved, it says "Saved copy from <date> · N sessions — *Use saved* /
  *Pull again*". The existing upload zone stays underneath as **Backup: upload a file**.
- `formReady` (l.569), the `handleRun` guard (l.314) and `StepCard complete` (l.688):
  `teramindFile` → "has punches from either source".
- Hard stop (new): pull errored, returned 0 sessions, or was truncated → Run stays disabled with a
  plain message. (Today an empty file silently produces a period full of absences.)
- Snapshot (l.366): for an API run store the `teramind_pull_log` id + counts instead of 100 rows.
- "file" wording in the two coverage warnings → source-neutral.
Unchanged on purpose: `teramindMaxDate` / mid-day checkbox (still derived from the rows), the
warnings gate, name-mapping step, `runEngine`, batching, `softDeleteStaleEntries`, `upsertPeriod`,
re-run confirm, the 14 `cfgGet` fallbacks, `teramindParser.ts`, `classificationEngine.ts`.

Check on `/dev`: pull a **past** period under View → compare the engine's preview counts with that
period's known green/yellow/red counts **without saving** (stop at the warnings gate); then Tim's
next real period is the first live use, with the upload file downloaded as a safety net that day.

### Phase E — live Attendance (after payroll is proven; no payroll file touched)
Today Attendance only knows a day once its period has been processed — up to two weeks late
(`not_processed`). With the saved copy, days **not yet captured** are filled from live data:
- Pure lib `liveAttendance.ts`: saved sessions + the employee's schedule → entry, exit, minutes late,
  using the **same injected helpers** the report already uses (`getSchedule`, `isScheduledWorkDay`,
  `parseTimeToMinutes`) — no copy of engine rules, no writes. Forms / PTO / holidays attach exactly
  as they do today via `buildAttendanceReport`.
- **Captured days always win**: if a `payroll_entries` row exists, it is shown (it is where Tim
  corrects things). Live rows carry a **Live** chip and never count as an official absence —
  today's "no punches yet" is *not* an unexplained absence until the day is captured.
- Additive only: new loader use (`loadTeramindSessions`, already viewer-scoped), a small merge in the
  List and Reports data hooks, the Live chip. Separate prompts, separate review with Saul.
This phase is the bridge into the parked Activity feature, which reads the same table.

### Phase F — wrap up
`src/AGENTS.md` prompt (new tables, libs, datasource, "conversion lives only in `teramindTime.ts`",
Teramind tab); by hand: HANDOFF, LESSONS, BACKLOG — including the two safety gaps deliberately
**not** fixed here (re-run overwrites reviewed rows; no lock after HRK export), fix stale
"baseline 264" in CLAUDE.md. Then revise the parked Activity plan to read `teramind_sessions`.

## Tests
New: `teramindTime.test.ts` (DST spring-forward / fall-back, 11 PM–midnight Eastern vs Panama,
late-night UTC stays on the previous Eastern date, output never carries a timezone and passes the
parser's own refusal regex), `teramindRows.test.ts`, `teramindPunches.test.ts` (**feeds its output
through the real `processTeramindData`** and asserts the same map a file would give; cross-midnight
session filed under its start date; keys lower-cased; two agents for one employee fold into one
day), `teramindPull.test.ts` (chunking, +1 day, truncation). `teramindGuards.test.ts`: HTTP actions
imported only by `useTeramindPull.ts` / the agents card; `zzProbe*` absent; no `teramind.co`
literal; new files < 15 KB; libs `import type` only; `ProcessPayroll.tsx` still has exactly 14
`cfgGet` fallbacks (existing L4). `SCOPED_ACTIONS` gains `loadTeramindSessions`. Baseline: 299.

## How the build is run
UIB loop stays sequential in the main session. Before each prompt: **sonnet** agents port/write
the libs + tests in the scratchpad (green before pasting); **haiku** fills the action/migration
templates; one **opus** review of the Phase D prompt before it is sent (a failed cycle on the
57 KB payroll page is the expensive mistake). Agents write files and return 5-line summaries.

## Verification
1. `node --test "tests/*.test.ts"` green after every prompt; `git status --short` shows only the
   files that prompt allowed.
2. Phase B: Teramind tab on `/dev` (hard refresh) — roster syncs, every active Panama employee is
   linked or listed as unlinked, one period pulls and the log row shows counts.
3. Phase C: comparison screen screenshots reviewed with Saul; findings doc committed.
4. Phase D: Process Payroll on `/dev` — Pull fills step 2; upload still works; Run blocked on an
   empty/failed pull; past-period dry run matches known counts; Attendance and Payroll Master
   unchanged. `payroll_entries` row count for past periods unchanged. Release only when Saul says.

## Risks (plain)
- **Teramind may not keep old data** → fewer past periods to compare; the probe tells us first.
- **Differences where Tim hand-edited punches** are expected and will be listed, not hidden.
- **Timezone**: confined to one tested lib; stored as Eastern clock text like everything else.
- **Re-runs still overwrite reviewed rows and paid periods aren't locked** — unchanged from today,
  logged in the backlog; worth a follow-up once pulling is one click.
- **Running before a period ends** still creates absences for the remaining days — unchanged;
  the existing coverage warning keeps working because it reads the pulled rows.
