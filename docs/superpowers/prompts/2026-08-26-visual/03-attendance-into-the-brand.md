# Attendance: brand colours instead of the borrowed iOS palette

Saul approved this directly: Attendance currently uses Apple's iOS system
colours, which appear nowhere else in the product, so the page reads as a
different application. Bring it onto the same chart tokens as everything else.

Five files, all under Attendance:

- `src/app/lib/attendanceStats.ts`
- `src/app/pages/attendance/AttendanceDonuts.tsx`
- `src/app/pages/attendance/AttendancePanel.tsx`
- `src/app/pages/attendance/AttendanceTrends.tsx`
- `src/app/pages/attendance/AttendanceKpis.tsx`

## 1. Replace every one of these hex values, everywhere in those files

This is a straight substitution. The replacements are the values of
`--chart-1` … `--chart-6` and `--border` in `src/index.css`.

| Replace | With | Why |
|---|---|---|
| `#34c759` | `#2AA876` | GAF teal — the brand's positive colour |
| `#ff9f0a` | `#FBBF24` | chart-3 amber |
| `#ff6b00` | `#D97706` | a darker amber, so the 11–30 min bucket still sits between amber and red |
| `#ff3b30` | `#EF4444` | chart-4 red |
| `#af52de` | `#6366F1` | chart-6 indigo |
| `#636366` | `#94A3B8` | chart-5 slate |
| `#8e8e93` | `#94A3B8` | chart-5 slate |
| `#0071e3` | `#1B3A6B` | chart-1 navy |
| `#e5e5ea` | `#E2E8F0` | the border token, for chart grid lines |

Match case-insensitively — some are lowercase. `#1B3A6B`, `#94a3b8` and `#fff`
already present are correct; leave them.

**`attendanceStats.ts` must keep zero import statements.** These are literal
string values, so no import is needed. Do not add one — a previous change that
imported into this file broke the test suite, because it is the one module a test
loads directly.

## 2. Give the seven KPI tiles a hierarchy

`AttendanceKpis.tsx` renders seven tiles, each with its own colour, so nothing
stands out. Apply the same treatment `SummaryDashboard.tsx` just received — copy
that pattern so the two pages match.

Add a `tone` prop to the local `Kpi` component: `'lead' | 'alert' | 'plain'`,
default `'plain'`.

- **lead** — keeps its colour class, and the tile gains a navy left rail:
  `border-primary` plus `shadow-[inset_3px_0_0_var(--primary)]`.
- **alert** — keeps its red colour class.
- **plain** — the value renders `text-foreground` instead of its own colour.

Keep `text-2xl font-bold tracking-tight leading-none`, and add `tabular-nums`
to the value in all three tones.

Assign:

| Tile | tone | colour class |
|---|---|---|
| On-Time Rate | **lead** | `text-secondary` (GAF teal) |
| Late — Reported | plain | — |
| Late — Unreported | **alert** | `text-destructive` |
| Excused | plain | — |
| Permission | plain | — |
| Avg Min Late | plain | — |
| Days Tracked | plain | — |

On-Time Rate is the lead because it is the headline number on this page. Late —
Unreported is the alert because it is the one that needs somebody to chase a
form. Change the lead's class from `text-green-600` to `text-secondary` so it
uses the brand teal rather than a generic Tailwind green.

## Do not touch

- No file outside the five listed. Not `index.css`, not `tailwind.config.js`, not
  `Attendance.tsx`, not a shared component, not an action.
- Do not change any query, calculation, bucket threshold, chart type, axis,
  layout or label text. **No number on any Attendance screen may change.**
- Do not reorder the KPI tiles or the legend entries.
- Do not attempt to fix the donut charts' first-load rendering. That is a
  separate change.

## Acceptance criteria

- On the 60-day window, the figures are unchanged: `DAYS TRACKED` 1428,
  `ON-TIME RATE` 63.5% (907 of 1428), `LATE — UNREPORTED` 245.
- The donuts, the trend line and the employee panel all still render, now in
  navy / teal / amber / red / indigo / slate.
- On-Time Rate carries a navy left rail and reads in teal; Late — Unreported
  reads red; the other five read in the normal foreground colour.
- Nothing on the page is Apple green, orange or purple any more.
- No console errors.

Then confirm every identifier used in each file is imported.
