# Plan — "Activity" (Teramind monitoring) inside Attendance

> ## STATUS: PARKED on 2026-09-17 — do not build from this document as-is
>
> **Why parked:** Saul confirmed payroll will be revamped to pull punches from the Teramind API
> (no more manual file uploads). That revamp needs Teramind times **saved in our database**, which
> overturns two decisions below: "Live from Teramind" (Activity should read the saved copy instead —
> faster, permanent history, airtight manager scoping) and the employee-panel toggle (with punches
> coming from the API the panel can be one day-by-day view from the start). Plan the payroll revamp
> first; then revise this plan on top of it.
>
> **Superseded by:** `docs/superpowers/plans/2026-09-17-activity-monitoring-v2.md` (rebuilt on the saved copy after
> `2026-09-17-payroll-via-teramind-api.md` shipped to the draft). Kept for the record only.
> Research behind both plans: `docs/findings/2026-09-17-vp-work-pattern-monitor-and-teramind-api.md`
> and `docs/findings/2026-09-17-payroll-upload-pipeline.md`.
>
> **Carries over unchanged into the next plan:** Phase 0 probe (incl. item 7, API vs payroll
> punches), identity mapping (`employees.teramind_agent_id`), the shared `teramind*` libs and
> id-filtered actions, the policy settings (7h + 1h break, low < 6.5h, break over by 30+),
> Why-chips from `buildAttendanceReport`, Needs a look, Team grid, table + CSV, punches beside
> active time, Online now, super-only Charts, tabs inside Attendance, the agent/model build method.
>
> **Open for the next plan to decide:** the saved-copy table design and who/what runs the sync;
> build order (expected: probe → shared foundation + saved copy → read-only Activity showing API
> vs uploaded times for a few pay periods → switch payroll over only when they agree); fused
> day-by-day employee panel instead of the toggle.
>
> Payroll remains untouchable until Saul explicitly green-lights the revamp work itself.

## Context

The VP of Tech built a UI Bakery app (*work-pattern-monitor*) that reads the Teramind API and
shows work hours for the whole company. Saul wants it in the GAF Panama HR Hub, but fixed for
Panama: super users see all Panama employees, managers only their own people, and — the real
point — every "no activity / short day" must show **why** (sick form, PTO, holiday, day off,
WFH…), because the Hub already knows that and the VP's app never can. Headline metric:
**Avg Activity Time** = total active time on days with work ÷ days with work.

Research findings that shape the plan:
- The VP's app is also a UIB app with an HTTP datasource `Teramind API`; 2–3 calls per refresh;
  all times requested in `America/New_York` → matches the Hub's Eastern invariant.
- It **cannot be copied file-for-file**: 5 files are 18–52 KB (our limit is 15 KB), it downloads the
  *whole company* and filters in the browser, its "Precise" mode reports *logged-in* time as
  "active" time, and it hardcodes a stateside Friday-2 PM rule and a 2h/9h threshold.
- The Hub's Reports tab already builds one row per employee per scheduled work day with
  forms / PTO / holidays attached (`buildAttendanceReport`). That is exactly the overlay needed.
- Future (separate) project: replace manual payroll file uploads with the Teramind API. This
  feature must build the Teramind plumbing as **shared, tested, generically named** pieces, and
  stay **read-only — it never writes a payroll row.**

## Decisions made with Saul

| Topic | Decision |
|---|---|
| Placement | Two new tabs in **Attendance**: `Activity` (everyone, scoped) and `Activity Charts` (super users only). Not blended into the punch tables — shown side by side, cross-linked. |
| Data | **Live from Teramind** each load, asking only for the viewer's employees. No storage tables in v1. |
| Precision | **Always precise**: login sessions → first/last activity + breaks; activity feed → true active time. No "Precise" toggle. |
| Weekends | No toggle. Each employee's `work_days` decides scheduled vs day off; activity on a day off is shown and marked. |
| Policy | 7h work + 1h break (split or not). **Low activity = under 6.5h active** on a standard day (scaled for other shift lengths). Admin-editable. |
| Breaks | Show **Total break time** (first→last activity minus active); amber only when over allowance by 30+ min. **Also keep** the VP's lunch start/end/minutes. |
| Screens | KPI strip, **Needs a look** list, Team grid, Day-by-day table (+CSV), super-only Charts. |
| Employee panel | **One shared panel, two tabs: Attendance \| Activity** — not a second panel. Opens from the List tab, the grid or the table, landing on the matching tab. Header carries the **Open agent in Teramind** link. (First slice of roadmap item C, Employee 360.) |
| Extras | **Logged-in vs actually active** (payroll punches beside Teramind active time), **Who's online now**. |
| Dropped | Fake ECG loader, dock-magnifier, number count-up animation, dark theme, dead code, "Session fragmentation" chart, VP's 30 KB stylesheet (use the Hub's look). |

Settings (in `classification_config`, category `monitoring`, never hardcoded):
`monitoring_break_minutes=60`, `monitoring_min_active_minutes=390`,
`monitoring_break_over_minutes=30`, `teramind_base_url` (for the deep link).

## Phase 0 — Probe first (no app files change)

Folder: `docs/superpowers/prompts/2026-09-17-activity/`. `00-probe.md` in the house format
(model: `2026-09-07-disciplinary/02c-probe-datasource-name.md`). If UIB's AI needs an action file
to make HTTP calls, `00b` allows exactly one throwaway `src/actions/zzProbeTeramind.ts`; `00z`
deletes it (a guard test keeps it gone). Results saved as `00-probe-RESULTS.md`.

The probe records:
1. Exact datasource display name to use in `datasourceName` (the yml name is not authoritative).
2. `/v1/agents` field list — which field is the email, does it equal `employees.teramind_email`;
   is `online` returned; can the call be limited to ids.
3. Does `agent: { in: [...] }` work on the **activity** cube and on **login_session** (array vs
   single, numeric vs string ids, object vs raw body). The VP's note says sessions return 0 rows
   when filtered — may just be a serialization bug. What does an empty `in: []` return?
4. login_session: timestamp format/offset, is `date` Eastern, do weekend rows exist, max `time_s`.
5. Which activity measure reproduces Teramind's own **Avg Activity Time** for 2–3 named
   employees over a fixed week (Saul reads the numbers off Teramind; they become the acceptance
   oracle).
6. Row counts for Panama-only ids over 14 and 31 days vs the 50,000 limit.
7. **For the future payroll project:** API first/last session per day vs `payroll_entries`
   entry/exit for 3 employees × 5 days — differences in minutes.

Decision gates after the probe:
- **G-B (needs Saul):** if login sessions truly can't be filtered by person → either (i) precise for
  super users only, managers get the hourly estimate (±30 min, badged `est`), or (ii) estimate for
  everyone. Never silently pull the whole company into a manager's browser.
- **G-C:** lock the active-time formula to whatever matches Teramind's figure.
- **G-D:** timestamps are instants → convert in one lib; already Eastern → parse without `Date`.

## Architecture

```
scoped SQL (existing)                      Teramind HTTP (new, id-filtered)
loadAttendanceEmployees  ──ids──────────▶  loadTeramindActivityHours   (active sec per hour)
 (+ teramind_agent_id)                     loadTeramindSessions        (login sessions)
6 Reports-tab loaders                      loadTeramindAgentsOnline    (online flags)
      │                                              │
      ▼                                              ▼
buildAttendanceReport (existing, untouched)   teramind* pure libs (shared, reusable by payroll later)
      └──────────────┬───────────────────────────────┘
                     ▼
        buildActivityDays()  →  ActivityDay[]  (one per employee per day: active, first/last,
        breaks, lunch, punches, scheduled?, WHY chip, flag, needsLook)  → all screens
```

**Identity:** migration adds nullable `employees.teramind_agent_id`. A super-only
`TeramindLinkSync` (runs when a super user opens Activity) reads the Teramind roster, matches on
`teramind_email`, writes ids. Managers' browsers never receive the company roster. Unlinked
people show **"Not linked to Teramind"**, never "No activity". (This mapping is also what the
payroll project will need.)

**Context rules (in `buildActivityDays`):** no `ReportRow` for a date = day off / not yet hired
(safe by construction — avoids the `permissionCoversDate` weekend trap). Why-chip from
`ReportRow.coveredBy` / `form` / `verdict`, plus raw `ReportRequest[]` for WFH and Time-for-Time
(only on scheduled days). `needsLook` = scheduled day, before today, linked, not macbook-swap,
no Why chip, and (no activity or active < threshold). Avg Activity Time = Σ active ÷ days with
work, per employee and team.

## Files

**Migration:** `src/migrations/<ts>_monitoring_config_and_agent_id.sql` (idempotent; rollback stated).

**Actions (`src/actions/`, each <1 KB; model: `pullMondayBoard.ts` — backtick object body, whole
`{{params.x}}`, never quoted):** `loadTeramindActivityHours`, `loadTeramindSessions`,
`loadTeramindAgentsOnline`, `loadTeramindAgentDirectory` (super-only caller),
`loadMonitoringConfig` (only `category='monitoring'` keys), `updateEmployeeTeramindAgentId`;
additive change to `loadAttendanceEmployees` (+`teramind_agent_id`, `is_macbook_swap`).

**Pure libs (`src/app/lib/`, zero runtime imports, `import type` only — model:
`attendanceReport.ts`):**
- `teramindTime.ts` — instant → Eastern `{date, minutes}` via `Intl` (ports VP `lib/utils.ts`). The
  only place a timezone conversion exists; result is displayed, never stored.
- `teramindRows.ts` — `agentIdOf` (handles `[42]`, `[{id}]`, scalar), row normalizers, email matching.
- `teramindSessions.ts` — `mergeIntervals`, `buildSessionDays` (ports VP `lib/sessions.ts`; session
  dated by its start, same rule as `tests/crossMidnight.test.ts`; fixes VP's date-slice bug).
- `teramindHourly.ts` — hourly estimate + lunch fallback (ports `computePatternTs`/`detectLunch`
  from VP `app.tsx`). **Cut if the probe shows sessions are reliably present.**
- `activityTypes.ts`, `activityDays.ts` (`buildActivityDays`, `summarizeActivity`; replaces VP
  `thresholds.ts`), `activityCharts.ts` (chart aggregations).

**UI (`src/app/pages/attendance/`, each aimed <12 KB):** `useAttendanceReportData.ts` (shared hook
lifting the 7-loader composition from `AttendanceReport.tsx` lines 36–107; **do not refactor the
Reports tab onto it in v1**), and under `activity/`: `useTeramindActivity.ts` (mutate-style calls,
**returns early when ids are empty**, truncation flag, cache + Refresh), `AttendanceActivity.tsx`
(shell), `ActivityKpis`, `ActivityWhyChip`, `ActivityNeedsLook`, `ActivityGrid` (ports
`coverage-heatmap`; holidays dimmed like days off), `ActivityTable` (+CSV with Why column),
`ActivityPanelBody` + `ActivityDayTimeline` + `ActivityBreakBars` (port `side-panel`),
`ActivityOnlineStrip`, `TeramindLinkSync`, `ActivityHelp`
(port the VP's honest methodology copy), `AttendanceActivityCharts` + `ActivityChartsTime` +
`ActivityChartsWork` (recharts, already a dependency). Reuse `DataTable`, `StatusChip`, `InfoTip`,
`EmptyState`, `matchesManager`, `toLocalYMD`/`getSchedule`/`isScheduledWorkDay`.

**Shared employee panel:** new `src/app/pages/attendance/EmployeePanel.tsx` (~5 KB: overlay,
slide-in, header with name/schedule/role/manager chips + Teramind link, tab switch
`attendance | activity`, optional `initialDate`). `AttendancePanel.tsx` (12.8 KB today) is reduced to
its **body** (KPIs, arrival scatter, recent activity, donuts) — it gets smaller, not bigger. Each tab
body loads its own data when the opener didn't supply it: Attendance body via
`loadAttendanceDaily` (already has an `email` param) + `computeEmployeeStats`; Activity body via
`useTeramindActivity` with that one agent id. `Attendance.tsx` and the Activity shell both render
`<EmployeePanel>`.

**Wiring (existing files, one prompt):** `src/app/app.tsx` (explicit
`/attendance/activity-charts` route wrapped in `<RequireSuper>` *before* the `/attendance/*` splat),
`Attendance.tsx` (`tabFromPath`: check `activity-charts` before `activity`), `TopNav.tsx` (two links;
filter links with existing `canSeePath`), `FilterBar.tsx` (`'/attendance/activity'` and
`'/attendance/activity-charts'`: `{ dateRange, employee, role, manager }`; default = last 14 days
ending yesterday), `src/app/lib/access.ts` (`SUPER_ONLY_PREFIXES`).

Charts v1 (leave-aware, all employees not "top 20"): avg active per employee, daily start/end
trend, day-of-week, daily flag breakdown, lunch histogram. Start-time and worked-time histograms
only if missed after a week of use.

## Prompt sequence (each = one UIB change-loop cycle, files named exactly, verified on `/dev`)

| # | Change | Check on /dev |
|---|---|---|
| 00 | Probe (+00b/00z if needed) | Results file committed; gates decided with Saul |
| 01 | Migration: column + 4 config keys | Admin → Rules & Config shows a Monitoring group |
| 02 | 4 `teramind*` libs, code verbatim | Tests green; diff `src/` vs prompt code block |
| 03 | 6 actions + additive loader change | Each action returns rows; Attendance List count unchanged |
| 04 | `activityTypes` + `activityDays` verbatim | Tests green |
| 05a | Shell, hooks, KPI strip, link sync (new files only) | — |
| 05b | Wiring (routes, nav, filter bar, access) | View-as manager: only their team, no Charts link, URL redirects; super sees both; **Avg Activity Time matches the probe oracle** |
| 06 | Team grid | Holiday column dimmed; PTO cell shows chip; day-off activity marked |
| 07 | Table + CSV | "Logged in 9h05 · active 4h10", punches, Why column |
| 08a | Panel refactor: `EmployeePanel` frame + `AttendancePanel` becomes body. **Zero visual change.** | List tab panel looks and behaves exactly as before (before/after screenshots) |
| 08b | Activity tab in the panel (3 files) + open from grid/table | Timeline, break bars, HR card, Avg Activity Time, Teramind link from config; opening from List tab shows Activity for that person too |
| 09 | Needs a look | Excludes today, unlinked, macbook-swap, anything with a Why chip |
| 10 | Online-now strip | Only the viewer's people |
| 11a/b | Charts lib, then Charts tab | Renders for super; blocked for manager |
| 12 | Help / methodology | Reads correctly |
| 13 | `src/AGENTS.md`: routes, libs, datasource, "conversion lives only in `teramindTime.ts`" | `agentsDoc.test.ts` green |
| 14 | Docs by hand: new HANDOFF, LESSONS, BACKLOG (incl. "payroll via API" as future item; fix stale "baseline 264" in CLAUDE.md → current count) | — |

TDD order (since only UIB writes `src/`): develop each lib + its tests in the scratchpad until green →
paste lib verbatim in the prompt → after sync, diff against the prompt → tests land in the same commit.
Before starting: write the spec to `docs/superpowers/specs/2026-09-17-activity-monitoring-design.md`
and commit it with the prompts folder.

## How the build is run — parallel agents, right-sized models

The UIB loop is strictly sequential (one builder session, one prompt at a time) and stays with the
main session (Fable): probe, decisions, pasting, export/sync, diff review, `/dev` verification,
commits. Everything *before* a prompt reaches UIB is parallelised. The enabler is **freezing the
contract first**: the main session writes `activityTypes.ts` (the `ActivityDay` shape) and the
Teramind row shapes from the probe results; every agent builds against that and nothing else.

| Wave | Runs in parallel | Model | Why that model |
|---|---|---|---|
| 1 (after probe) | Port `teramindTime` + `teramindRows` + `teramindSessions` + `teramindHourly` with tests, green in scratchpad | **sonnet** | Faithful port of existing VP code with tests — mechanical but needs care |
| 1 | `activityDays` + tests (HR-context merge, thresholds, needs-a-look, the known traps) | **opus** | The one piece of subtle logic; mistakes here accuse real people |
| 1 | Migration prompt, actions prompt (6 tiny files from the `pullMondayBoard` template), AGENTS.md file-map prompt | **haiku** | Template filling |
| 2 (libs green) | Four independent drafters: grid prompt, table+CSV prompt, panel prompts (08a/08b), charts lib+prompts — each reads only its one VP file + one Hub pattern file | **sonnet** ×4 | Independent UI ports against the frozen types |
| 2 | Assemble verbatim-code prompt files from finished libs; help/methodology copy; docs drafts | **haiku** | Copy-assembly |
| 3 | One pre-flight review of all libs + prompts before any UIB cycle (a UIB round-trip is the expensive thing — catch errors before it) | **opus** (`agent-skills:code-reviewer`) | One careful pass is cheaper than a failed prompt cycle |

Token discipline: each agent gets a narrow brief (exact file paths, the frozen types, the house
prompt example to imitate) — no re-exploring the repo; VP files are read one at a time via
`unzip -p`; agents **write their output to files** (scratchpad libs/tests, prompt `.md` files) and
return only paths + a 5-line summary, so code never flows back through the main context; the main
session verifies by running tests and checking sizes, not by re-reading everything. No agent
touches `src/`. Agents write to disjoint files, so no worktree isolation is needed.

## Tests

New: `teramindTime.test.ts` (DST spring-forward/fall-back, late-night UTC stays on previous Eastern
date, no `toISOString`), `teramindRows.test.ts`, `teramindSessions.test.ts` (merge ≤60 s, 10 h cap,
lunch 20–120, cross-midnight), `teramindHourly.test.ts`, `activityDays.test.ts` (6.5h threshold scaled
for short shifts, break amber at allowance+30, day-off activity, weekend inside a Fri→Mon permission
gets no chip, WFH only on scheduled days, today/unlinked/macbook-swap never flagged, Avg Activity
denominator), `activityCharts.test.ts`.

`activityGuards.test.ts` (stands in for G2, which can't see HTTP actions): every `/wip/tma-query`
action contains the agent `in` filter; no pass-through body/URL params; `zzProbe*` absent; cube
actions imported only by `useTeramindActivity.ts`, which has the empty-ids early return; roster
action imported only by `TeramindLinkSync.tsx` (checks `isSuper`); no `teramind.co` literal; every
new file <15 KB; new libs `import type` only. G1 list gains `/attendance/activity-charts`.
Baseline today: 299 passing.

## Verification (end to end)

1. `node --test "tests/*.test.ts"` — all green after every prompt.
2. `git status --short` after each sync shows only the files that prompt allowed.
3. On `https://uib.vitasya.cloud/dev/vitasya/jAaT7LYarG/attendance/activity` (hard refresh;
   app is inside an iframe): as super → all Panama employees; **View as** a manager → only their
   team; Charts URL redirects for the manager. Screenshots for Saul.
4. Avg Activity Time for the 2–3 oracle employees equals Teramind's own figure.
5. Spot-check 3 days Saul knows: a sick-form day shows the chip and is **not** in Needs a look; a
   holiday column is dimmed; a weekend worker's Saturday counts as scheduled.
6. Confirm no row in `payroll_entries` changed (feature is read-only). Release only when Saul says so.

## Risks (stated plainly)

- **Scoping is app-level, not database-level.** Teramind is an HTTP source, so the database can't
  enforce it. The app only ever asks for the viewer's people and guard tests keep it that way, but a
  technically skilled signed-in user could call the action with other ids. (The VP's app exposes
  everyone to everyone, so this is strictly tighter.) Saving a daily copy in our DB later would make
  it airtight.
- **6.5h is strict.** If Teramind doesn't count meetings/calls as active, Needs a look will be long at
  first — tune the Admin setting after a week of real data.
- First timezone conversion in the codebase → confined to one tested lib, never stored.
- 50k-row cap → banner when hit; chunk by week only if the probe says it's needed.
- Cross-midnight workers: sessions dated by start; hourly feed stays calendar-dated (documented).
