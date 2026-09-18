# Plan v2 — "Activity" inside Attendance, rebuilt on the Teramind saved copy

**Decisions of 2026-09-18 are in `docs/superpowers/prompts/2026-09-18-activity/CONTRACT.md` and override anything below.**

**Status: PLAN ONLY — nothing here is built.** Supersedes
`2026-09-17-activity-monitoring-PARKED.md` (kept for the record). Written 2026-09-17 evening, after
the payroll-via-Teramind work (`2026-09-17-payroll-via-teramind-api.md`) shipped to the draft app.

## What the goal still is

Saul's original ask, unchanged: managers of remote staff see their own people's work pattern —
when they start, how long they are actually active, breaks — and **every "no activity / short day"
shows why** (sick form, PTO, permission, holiday, day off, WFH), because the Hub already knows that.
Headline metric: **Avg Activity Time** = total active time on days with work ÷ days with work.
Super users see all Panama employees; managers only their own (scoped in SQL, as everywhere).

## What changed underneath (why the old plan no longer fits)

| Then (parked plan) | Now (built today) |
|---|---|
| Call Teramind live from the Activity pages, per viewer, every load | **We keep a copy** (`teramind_sessions`, source `time_record`), refreshed every 15 min while a super user is on, backfilled for all 12 past periods. Pages read the copy through viewer-scoped SQL. |
| Two feeds: `login_session` (first/last, breaks) + `activity` cube (true active time) | **One feed: Time Records** — the same records payroll's file came from. Exact instants, live for today. Login sessions were proven wrong (33% match) and the activity cube is a day behind. |
| Identity: `employees.teramind_agent_id` + a link-sync on page open | `teramind_agents` (many accounts → one person, incl. former employees and deleted accounts) + Admin → Employees → Teramind roster sync + manual link. |
| A probe phase with seven questions | All answered (`prompts/2026-09-17-teramind-payroll/00-probe-RESULTS.md`, two addenda). |
| Attendance tabs: List · Reports | Attendance tabs: **Today · List · Reports**. Today is already a live board (status, entry, late, last activity, active time). |
| "Who's online now" needs a live Teramind call | Today already shows **Working** = activity within the last 20 minutes from the copy. The true `online` flag would need a super-only HTTP call per view. |
| Payroll punches beside Teramind time = a nice-to-have overlay | `loadTeramindVsPayroll` + the comparison screen already do exactly this, day by day, for every past period. |

## Redundancy audit of the parked plan

**Done — drop from the plan (exists in the app):**
Phase 0 probe · datasource name · identity mapping and roster sync (`teramind_agents`, link UI) ·
`teramindTime.ts`, `teramindRows.ts` (`normalizeTimeRecord`, `linkAgents`) · the HTTP actions and
the pull hook · the saved copy + keep-fresh sync · Online-now strip (covered by Today's Working /
Away) · "Logged-in vs actually active" (covered by Teramind vs Payroll) · AGENTS.md documentation
of the Teramind pieces · the "which measure matches Avg Activity Time" question is now "sum of
record durations per day", to be confirmed once against Teramind's Time Cards (see Slice 3).

**Dropped — no longer makes sense:**
`teramindHourly.ts` (hourly estimate; records are exact) · `useTeramindActivity` (live calls from
pages) · `loadTeramindActivityHours` / `loadTeramindAgentsOnline` · gate G-B (manager estimate mode)
· gate G-D · the "Precise" question · "Live from Teramind" decision · `TeramindLinkSync` on page open
· `useAttendanceReportData` hook refactor (not needed; the range view composes the same loaders
the Reports tab does, in its own file) · `activity-charts` route trap notes (still true, but only
if a Charts *route* is created — see Slice 6, which uses a super-only tab inside Attendance instead).

**Kept, but changed shape:**
- `teramindSessions.ts` (merge intervals, breaks, lunch) → **`activityDays.ts`** working on per-day
  aggregates computed in SQL from the saved copy (first, last, active seconds, records, largest gap),
  not on raw login sessions in the browser.
- Why-chips from `buildAttendanceReport` → **still the core**, but now also on the Today board, and
  the report already yields `coveredBy` / `form` for days payroll has not captured yet (verified in
  `attendanceReport.ts:304-337`: holiday → payroll label → Monday request → then `not_processed`).
- Employee panel: the "Attendance | Activity toggle" question is settled by the saved copy — **one
  day-by-day panel** where each day shows the official punches when captured, Teramind times
  otherwise, plus active time and the Why chip. Deferred to Slice 7 so the first slices stay small.
- Settings: `monitoring_*` keys → category **`teramind`** (already exists for the sync interval),
  keys `activity_min_active_minutes=390`, `activity_break_minutes=60`, `activity_break_over_minutes=30`,
  `teramind_base_url` (deep link). Still admin-editable, still never hardcoded.
- Charts (super only) → last slice, inside Attendance as a fourth tab **Charts** shown only to super
  users (link filtered with `canSeePath`, route wrapped like the other super-only pages).

**Kept as is:** policy (7 h + 1 h break; low activity < 6.5 h scaled to shift length; break amber at
allowance + 30 min); weekends by `work_days`; the drop list (ECG loader, magnifier, count-up, dark
theme, confetti, fragmentation chart, VP stylesheet); Needs-a-look rules; CSV export; deep link
"Open in Teramind" from config + `teramind_agents.agent_id`.

## Decisions made 2026-09-18

- Wording: Title Case for all labels, chips, headers, buttons. Dates `Wed Sep 11`, times `8:02 AM`.
- The live board is called **Live** (not "unofficial").
- Why chips: `PTO`, `Permission` (with hours when available), `Sick` (any attendance form), form types in Title Case, `Holiday · <name>`, `WFH`, `Day Off` (no schedule + activity), English payroll labels, `No Reports Yet` (amber).
- Dropped: "Time for Time" chip, "pending" state.
- No row when not scheduled and no activity.
- English payroll labels: `Incapacidad`→`Sick`, `Permiso`→`Permission`, `Feriado`→`Holiday`, others in Title Case.
- Per-employee expandable view as default for multi-day ranges.
- One shared employee panel opened from Today, List, and Activity.
- FilterBar: Periods | Dates switch with quick picks (Today, This Week, Last 14 Days, This Period So Far, Last Period).
- Every sync every 15 minutes with one setting in `teramind` category.
- Payroll Master opens empty.
- Charts deferred, mocked up later.
- "Online flag" question closed as not needed.

## Revised design (data first)

```
saved copy (SQL, viewer-scoped)                     HR context (existing loaders, unchanged)
loadTeramindActivityDays({dateFrom,dateTo,viewAs})  loadAttendanceReportDays · loadMondayAttendanceFormsRange
  one row per employee-day: first_min, last_min,    loadMondayRequestsRange · loadHolidays · loadPeriods · loadDstCalendar
  last_ymd, active_min, records, largest_gap_min,   loadAttendanceEmployees
  gap_start_min, has_manual, synced_at                       │
              │                                              ▼
              │                              buildAttendanceReport (untouched) → ReportRow per scheduled day
              └──────────────┬───────────────────────────────┘
                             ▼
              buildActivityDays()  (pure lib, tests)  →  ActivityDay[]
              one per employee per calendar day in range:
              scheduled? · official punches (captured) · Teramind first/last · active · breaks total
              · largest gap (lunch) · WHY chip · flag (low / long break / none) · needsLook · Avg Activity Time
                             ▼
     Today board (why chips)   Activity tab (KPIs, Needs a look, grid, table+CSV)   Charts (super)
```

**The one new SQL action** (`loadTeramindActivityDays`) does the heavy lifting with window functions
(`LAG` on `started_et` per employee-day gives the largest gap and where it starts), returns
integers only (date-looking text is rewritten on the way to the browser), filters
`source = 'time_record'`, and is viewer-scoped. Nothing new touches Teramind itself.

**Why-chip rules (in `buildActivityDays`):**
no `ReportRow` for the date → *day off / not yet hired* (never flagged) · `coveredBy.kind` holiday /
pto / permission → chip with its label · `form` → chip "Form: <type>" · WFH / Time-for-time from the
raw `ReportRequest[]` on scheduled days · captured day with payroll label (Incapacidad, Permiso…) →
that label wins (payroll is where days get corrected). `needsLook` = scheduled, before today, has no
chip, and (no records or active < threshold). Today is never in Needs a look.

**Active time definition:** Σ `duration_s` of the day's Time Records (what Teramind's own Time
Cards show as worked time). Breaks total = (last − first) − active. Both cut to minutes.

## Slices (each = one or two UIB prompts, verified on /dev, committed; order matters)

| # | Slice | Touches payroll? | Check on /dev |
|---|---|---|---|
| 1 | **Why chips on Today.** Load the four HR loaders the Reports tab uses (forms, requests, holidays, periods) for `day` only; `buildAttendanceReport` for that day; chip next to "No Records" / low active. Status becomes **On Leave / Sick Form / Permission / Holiday / WFH** instead of "No Records" when a reason exists. | No | Someone on PTO today shows the PTO chip, not "No Records". |
| 2 | **Settings + activity SQL + `activityDays.ts`** (lib verbatim, test-first: thresholds scaled by shift, cross-midnight, holiday/day-off never flagged, WFH only on scheduled days, Avg Activity denominator, today excluded from Needs a look). | No | Tests green; action returns rows for a past period. |
| 3 | **Activity tab: KPI strip + By Employee (expandable) + By Day (+CSV).** Fourth Attendance tab, default range last 14 days ending yesterday, FilterBar `{dateRange, employee, role, manager}`. KPIs: Avg Activity Time (team), days with work, Needs a look count, late arrivals. By Employee: expandable rows. By Day: one row per employee-day with Why column. **Oracle:** Saul reads Avg Activity Time for 2 people × 1 week off Teramind's Time Cards; ours must match. | No | Numbers match Teramind; View As a manager shows only their people. |
| 4 | **Needs a look** list on the Activity tab (rules above), each row linking to the day. | No | A sick-form day is *not* in the list; a bare short day is. |
| 5 | **Team grid** (employees × days, heat by active minutes, chips inline, holidays/days-off dimmed). | No | Weekend worker's Saturday counts as scheduled. |
| 6 | **Charts** tab, super users only (`SUPER_ONLY_PREFIXES`, explicit route before the splat, G1 list). recharts is already a dependency. | No | Manager: no link, URL redirects. |
| 7 | **Employee panel Day By Day section** (split panel into frame + body first). Official punches when captured, Teramind otherwise, active, Why. Opened from List, Today, Activity. | No | List-tab panel unchanged before/after screenshots. |
| 8 | Help/methodology copy; AGENTS.md; handoff/lessons/backlog. | No | — |

Slice 1 alone delivers the thing Saul asked for on day one ("it shows absent but doesn't say why").

## Build method (unchanged from today's run, it worked)

Libs and SQL are written test-first outside the app and pasted **verbatim** (diffed after every
export); UI is spec-only prompts; every prompt opens with the "code root *is* `src`" note and names
its files; one **opus** pre-flight review before any prompt that touches a shared page
(`Attendance.tsx`, `TopNav.tsx`, `FilterBar.tsx`, `AttendancePanel.tsx`); **sonnet** agents port the
libs and draft UI prompts in parallel; the UIB loop stays sequential in the main session. Guards:
extend `teramindGuards.test.ts` (new scoped action in `SCOPED_ACTIONS`; no page under
`pages/attendance/` may import a Teramind HTTP action or `useTeramindPull`; Charts route in G1).

## Risks (plain)

- **Multiple accounts per person** (10 people): records from two accounts on the same day are summed;
  if they overlap, active time is over-counted. Cap active at (last − first) and show a small "2
  accounts" mark; fix properly only if the oracle check disagrees.
- **6.5 h threshold** will list many people at first; it is a setting.
- **Freshness** depends on a super user being online until a UIB Automation exists (BACKLOG #15).
- **Reason data is only as fresh as the Monday mirrors** (forms/requests sync) — say so on the screen.
