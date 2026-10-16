# Attendance → List table: put back the exact header and Late cell from prompt 03c

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else.** The previous prompt (03c) was applied with different wording in two places; this puts the
specified text back.

**Only this file may change:** `src/app/pages/attendance/AttendanceTable.tsx`. **No other file may
be touched.**

## 1. `src/app/pages/attendance/AttendanceTable.tsx` — two edits, nothing else

**1a.** Replace

```tsx
              <Th label="Employee"         col="name"      tooltip="Name from the roster. Click a row to open the viewer." />
              <Th label="Manager"          col="manager"   tooltip="Manager from the Employee Directory." />
              <Th label="Schedule"         col="schedule"  tooltip="The shift assigned in Admin → Schedules; lateness is measured against its start time." />
              <Th label="On-Time"          col="pctOnTime" tooltip={ON_TIME_TOOLTIP} />
              <Th label="Late"             col="totalLate" tooltip="Days clocked in after the scheduled start. The number in red is days with no GAF Attendance form." />
              <Th label="Absent"           col="absent"    tooltip="Scheduled days with no clock-in and no time off or permission." />
              <Th label="Avg Min (Worked)" col="avgMinLate" tooltip="Average minutes late across the days someone actually worked." />
              <Th label="Reporting"        col="reporting" tooltip={REPORTING_TOOLTIP} />
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

**1b.** Replace

```tsx
                <td className="px-3 py-2.5 min-w-[140px]"><OnTimeBar pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className="font-medium text-status-yellow-ink">{s.totalLate}</span>
                  {s.unreported > 0 && <span className="ml-1 text-status-red-ink text-xs">({s.unreported})</span>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-status-red-ink">
```

with

```tsx
                <td className="px-3 py-2.5 min-w-[120px]"><OnTimeBar pct={s.pctOnTime} days={s.days} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-status-yellow-ink font-medium">{s.totalLate}</div>
                  {s.unreported > 0 && (
                    <div className="text-[11px] text-status-red-ink whitespace-nowrap">{s.unreported} Not Reported</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-status-red-ink">
```

## Acceptance

- The Late column shows the late count, and under it, in small red text, "N Not Reported" when N > 0.
- The Avg Min (Worked) heading explanation says "on-time days included".
