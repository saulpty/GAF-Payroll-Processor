# Attendance → List: eight columns instead of seventeen (part 3 of 3)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only this file may change:** `src/app/pages/attendance/AttendanceTable.tsx`. **No other file may
be touched.** No migration, no action file, no loader, no change to
`src/app/lib/attendanceStats.ts` or `src/app/lib/attendanceSort.ts`.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB.
- Presentation only: no number is calculated differently. Every value comes from the same
  `EmpStats` field as today.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.
  (Nothing in this prompt touches dates.)

## Why (Saul, 2026-10-16)

The List table had 17 columns, several saying the same thing twice: Status (Good / Fair / At Risk)
is decided by % On-Time alone; Total Late is Reported + Unreported; the Reporting pill summarises
Reported and Unreported; Role repeats the filter bar's Title filter. After this part each fact
appears once, in the words the phone rows already use (part 2):

Employee · Manager · Schedule · On-Time (bar, green / amber / red) · Late (with `x Not Reported`
in red under it when any) · Absent · Avg Min (Worked) · Reporting (Complete / Gaps / Rarely, x/y).

Every remaining column still sorts. `PctBar`, `STATUS_TOOLTIP` and `StatusBadge` are no longer
used anywhere after this part, so they are removed; `OnTimeBar` (added in part 2) replaces them.

## 1. `src/app/pages/attendance/AttendanceTable.tsx` — three edits, nothing else

**1a.** Replace (the old bar, the status explanation and the status pill)

```tsx
function PctBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? 'bg-status-green-ink' : pct >= 75 ? 'bg-status-yellow-ink' : 'bg-status-red-ink';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-border rounded-full min-w-10">
        <div className={`h-1 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

export const STATUS_TOOLTIP = 'Based on on-time rate alone: Good is 90% or above, Fair is 75–89%, At Risk is below 75%.';

export function StatusBadge({ pct, days }: { pct: number; days: number }) {
  if (days === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  if (pct >= 90) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Good — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-green-fill text-status-green-ink cursor-default"
    >
      Good
    </span>
  );
  if (pct >= 75) return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`Fair — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink cursor-default"
    >
      Fair
    </span>
  );
  return (
    <span
      title={STATUS_TOOLTIP}
      tabIndex={0}
      aria-label={`At Risk — ${STATUS_TOOLTIP}`}
      className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-red-fill text-status-red-ink cursor-default"
    >
      At Risk
    </span>
  );
}

export const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';
```

with

```tsx
export const REPORTING_TOOLTIP = 'Of the days that needed an explanation — late or absent — how many had a GAF Attendance form on file.';
```

**1b.** Replace (the header row)

```tsx
              <Th label="Employee"         col="name"      tooltip="Name from the roster. Click a row to open the viewer." />
              <Th label="Role"             col="role"      tooltip="Role from the Employee Directory." />
              <Th label="Manager"          col="manager"   tooltip="Manager from the Employee Directory." />
              <Th label="Schedule"         col="schedule"  tooltip="The shift assigned in Admin → Schedules; lateness is measured against its start time." />
              <th
                className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 bg-slate-50 border-b border-border whitespace-nowrap cursor-default"
                title={STATUS_TOOLTIP}
              >
                Status<InfoTip text={STATUS_TOOLTIP} />
              </th>
              <Th label="Reporting" col="reporting" tooltip={REPORTING_TOOLTIP} />
              <Th label="Expected"         col="days"        tooltip="Scheduled work days in range, excluding time off and permissions." />
              <Th label="On Time"          col="onTime"      tooltip="Days clocked in at or before the scheduled start." />
              <Th label="Total Late"       col="totalLate"   tooltip="Days clocked in after the scheduled start (Reported + Unreported)." />
              <Th label="Reported"         col="reported"    tooltip="Late days that had a GAF Attendance form on file." />
              <Th label="Unreported"       col="unreported"  tooltip="Late days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (Worked)" col="avgMinLate"  tooltip="Average minutes late across the days someone actually worked." />
              <Th label="% On-Time"        col="pctOnTime"   tooltip="On Time ÷ Expected. Green 90%+, amber 75–89%, red below 75%." />
              <Th label="1–10m"            col="b1to10"      tooltip="Late days where the delay was 1 to 10 minutes." />
              <Th label="11–30m"           col="b11to30"     tooltip="Late days where the delay was 11 to 30 minutes." />
              <Th label="31+m"             col="b31plus"     tooltip="Late days where the delay was more than 30 minutes." />
```

with

```tsx
              <Th label="Employee"         col="name"        tooltip="Name from the roster. Click a row to open the viewer." />
              <Th label="Manager"          col="manager"     tooltip="Manager from the Employee Directory." />
              <Th label="Schedule"         col="schedule"    tooltip="The shift assigned in Admin → Schedules; lateness is measured against its start time." />
              <Th label="On-Time"          col="pctOnTime"   tooltip={ON_TIME_TOOLTIP} />
              <Th label="Late"             col="totalLate"   tooltip="Days clocked in after the scheduled start. The red line under the number counts the late days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"      tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (Worked)" col="avgMinLate"  tooltip="Average minutes late across every day someone actually worked, on-time days included." />
              <Th label="Reporting"        col="reporting"   tooltip={REPORTING_TOOLTIP} />
```

**1c.** Replace (the rows)

```tsx
              <tr><td colSpan={17} className="px-4 py-12 text-center text-muted-foreground">No employees match these filters.</td></tr>
            )}
            {sorted.map(s => (
              <tr key={s.email}
                className="border-b border-border/60 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onRowClick(s.email)}>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.role || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.manager || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.schedule}</td>
                <td className="px-3 py-2.5"><StatusBadge pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5"><ReportingBadge s={s} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.days}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-green-ink font-medium">{s.onTime}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-yellow-ink font-medium">{s.totalLate}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-yellow-ink">{s.reported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-status-red-ink">{s.unreported}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-status-red-ink">{s.absent}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.avgMinLate.toFixed(1)}</td>
                <td className="px-3 py-2.5 min-w-[120px]"><PctBar pct={s.pctOnTime} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b1to10}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b11to30}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-xs">{s.b31plus}</td>
              </tr>
```

with

```tsx
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No employees match these filters.</td></tr>
            )}
            {sorted.map(s => (
              <tr key={s.email}
                className="border-b border-border/60 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => onRowClick(s.email)}>
                <td className="px-3 py-2.5 font-semibold text-foreground whitespace-nowrap">{s.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.manager || <span className="text-slate-300">—</span>}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs whitespace-nowrap">{s.schedule}</td>
                <td className="px-3 py-2.5 min-w-[120px]"><OnTimeBar pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-status-yellow-ink font-medium">{s.totalLate}</div>
                  {s.unreported > 0 && (
                    <div className="text-[11px] text-status-red-ink whitespace-nowrap">{s.unreported} Not Reported</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-status-red-ink">{s.absent}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{s.avgMinLate.toFixed(1)}</td>
                <td className="px-3 py-2.5"><ReportingBadge s={s} /></td>
              </tr>
```

`ReportingBadge`, `SortIcon`, the `Th` helper, the imports and the sorting state do not change.
`InfoTip` stays imported (the `Th` helper uses it).

## Acceptance — visible facts

1. Attendance → List on a computer: the table has exactly eight columns, in this order:
   Employee, Manager, Schedule, On-Time, Late, Absent, Avg Min (Worked), Reporting.
2. On-Time shows a bar and a percentage: green at 90% or above, amber 75–89%, red below 75%. A
   person with no expected days shows a dash. The percentage is the old % On-Time number.
3. Late shows the old Total Late number. When the old Unreported number was above 0, a small red
   `x Not Reported` line sits under it with that same number.
4. Absent, Avg Min (Worked) and Reporting show the same values as before.
5. Clicking each of the eight headings sorts by it; clicking again reverses it.
6. Clicking a row still opens the employee panel, unchanged. The phone rows are unchanged.
7. No console errors.

When done, reply with a one-line summary per file.
