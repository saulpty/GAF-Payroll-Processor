# VP's "Work Pattern Monitor" app and the Teramind API — what we learned

**Date:** 2026-09-17. **Source:** `work-pattern-monitor-main.zip` (a UI Bakery app, v3.194.0, built by
the VP of Tech), read without extracting (`unzip -p`). Nothing here has been verified against the
live API from the Hub yet — that is the probe in
`docs/superpowers/plans/2026-09-17-payroll-via-teramind-api.md`, Phase A.

Used by: the payroll-via-API plan (same folder) and the parked Activity plan
(`docs/superpowers/plans/2026-09-17-activity-monitoring-PARKED.md`).

---

## 1. How the VP's app talks to Teramind

A UIB `HTTP` datasource named `'Teramind API'` (base URL + auth live in the datasource, not in code).
In the Hub the datasource was connected by Saul on 2026-09-17; **its exact display name is unknown**
and it is not in `datasources.yml` yet (the yml name is not authoritative anyway — probe it).

Action format, verbatim:

```ts
import { action } from '@uibakery/data';
function fetchAgents() {
  return action('fetchAgents', 'HTTP', {
    datasourceName: 'Teramind API',
    options: { method: 'GET', url: '/v1/agents',
      queryParams: { fields: 'name,department_id,status,online,deleted,last_web_login' } },
  });
}
export default fetchAgents;
```

| Call | Notes |
|---|---|
| `GET /v1/agents` | Fields requested: `name,department_id,status,online,deleted,last_web_login`. **No email requested.** `online` fetched, never used. |
| `GET /department` | Department names. |
| `POST /wip/tma-query`, cube `activity` | `{ cube:"activity", timezone:{{params.timezone}}, aggregate:true, dims:["agent","date","hour"], measures:["time_s","idle_time_s"], dim_filters:{date:{range:[from,to]}}, limit:50000 }` — `bodyType:'object'`, unquoted params. A per-agent variant adds `agent:{in:[{{params.agentId}}]}`. |
| `POST /wip/tma-query`, cube `login_session` | `aggregate:false`, dims `agent,date,timestamp,computer`, measure `time_s`. Sent as `bodyType:'raw'` with `body:'{{params.body_json}}'` — **a quoted moustache, which our guard L2 forbids**. VP's comment: *"NO agent filter in the query — it silently returns 0 rows. Filter in JS."* May be a serialization / string-id bug. Must be probed. |
| `GET /v1/activity/aggregated` | Has a native `agents` filter. Dead code in the VP's app. |

Response shapes seen in the VP's normalizers: rows are a bare array **or** `{data:[…]}`; `agent` may be
`[42]`, `[{id:42}]` or a scalar; `time_s` is seconds; `idle_time_s` is always 0 on this account;
`timestamp` may carry an RFC-3339 offset. `TZ='America/New_York'` is hardcoded — matches the Hub's
Eastern invariant. Deep link: `https://vitasya.teramind.co/#/employee/{agent_id}` (base URL belongs in
config, never in code).

**Bug in the VP's code:** `normalizeSessionRows` slices the date straight off an offset-bearing
string — wrong if Teramind returns `+00:00`. Always derive date and time from the instant, via `Intl`
with `America/New_York`.

## 2. The VP's formulas and constants

- Thresholds: `SHORT_DAY_MINS=120`, `LONG_DAY_MINS=540`, `FRIDAY_SHORT_DAY_MINS=90`,
  `FRIDAY_LONG_DAY_MINS=390` (a stateside "Friday ends at 2 PM" rule — not Panama).
- **Sessions path** (`lib/sessions.ts`): cap each session at 10 h; merge intervals that overlap or sit
  within 60 s; day_start = first interval start, day_end = last interval end; total_worked = sum of
  merged intervals capped at 600 min; lunch = largest interior gap (20–120 min = lunch, >120 min =
  `extended_midday_absence`).
- **Hourly path** (`computePatternTs`, `detectLunch` in `app.tsx`): an hour is active when
  `time_s>=300`; offsets rounded to 5 min; lunch searched in hours 10–14 with `GAP_THRESHOLD=1200s`,
  `RETURN_THRESHOLD=300s`.
- "No activity" rows are synthesized back-fill for every agent/date with no data. There is no "late"
  metric. KPI "Avg active time" = mean of `total_worked_minutes` over rows > 0 (equals Teramind's Avg
  Activity Time at team level). Chart "Average worked time per employee" = top 20, active days only.
- **"Precise" mode reports logged-in time as active time** — wrong for Avg Activity Time. True active
  time comes from the `activity` cube; sessions give first/last and breaks.
- Heat scale `#EDEBE5` → `#6259A3` over 0–480 min. Deps: recharts ^2.13.3, react-day-picker.

## 3. Why it can't be copied file-for-file

| File | KB | | File | KB |
|---|---|---|---|---|
| `charts-row.tsx` | 52.4 | | `header-bar.tsx` | 13.3 |
| `app.tsx` | 35.7 | | `kpi-cards.tsx` | 13.0 |
| `side-panel.tsx` | 33.7 | | `help-page.tsx` | 13.0 |
| `detail-table.tsx` | 24.2 | | `heatmap-section.tsx` | 10.0 |
| `coverage-heatmap.tsx` | 18.5 | | `index.css` | 30.7 |

Five files break our 15 KB rule; it downloads the whole company and filters in the browser; it
hardcodes stateside rules; "precise" is mislabelled. Fluff to drop: fake ECG loader
(`teramind-loader.tsx`), dock magnifier (`mag-row.tsx`), KPI count-up, dark theme, canvas-confetti,
"Session fragmentation" chart, dead `buckets.ts` / `fetchActivityAggregated.ts`, the 30 KB stylesheet.

## 4. Where the VP's app shows a verdict with no context (the overlay targets)

19 spots, including: detail-table Flag badges (No activity / Short day / Extended absence), coverage
grid cells + tooltip + legend, side-panel Status tile, "⚠ No single lunch break detected" banner, red
bars in the per-employee chart, the CSV flag column, the Active agents KPI. Holidays are not dimmed the
way weekends are. The Hub already knows the "why" for each (forms, PTO, holidays, days off, WFH).

## 5. Hub integration facts (verified in the repo 2026-09-17)

- `employees.teramind_email` (unique) is the only bridge to Teramind today; there is no agent id.
- `buildAttendanceReport` returns one `ReportRow` per employee per **scheduled** work day on/after
  `start_date` — so "no ReportRow" = day off / not hired, which sidesteps the `permissionCoversDate`
  weekend trap. WFH and Time-for-time are pass-through (`coveredBy` null) — their chips need the raw
  `ReportRequest[]`, applied only on days that already have a ReportRow.
- `/attendance/*` is one splat route; guard G1 checks the line containing `path="…"` for
  `<RequireSuper>`, so a super-only tab needs its own explicit `<Route>` **before** the splat, plus
  `SUPER_ONLY_PREFIXES` and G1's list. TopNav filters sections, not links.
- `AdminLookups` groups config by category dynamically — a new category appears with no edit there.
- The payroll parser keys a session by its **start** date (`tests/crossMidnight.test.ts`).
- `pullMondayBoard.ts` is the only HTTP action and the model: backtick object body, whole-value
  moustaches, no ids, no auth.
- An HTTP datasource can't be viewer-scoped in SQL. A saved copy in our DB can — one more reason the
  payroll plan's `teramind_sessions` table comes first.

## 6. Open questions for the probe

Datasource display name · email field on `/v1/agents` · agents per employee · does the agent filter
work on `login_session` · what `in: []` returns · timestamp format · do weekend rows exist · which
measure matches Teramind's own Avg Activity Time · row counts vs the 50,000 cap · **how far back the
API keeps data** · API first/last vs `payroll_entries` entry/exit.
