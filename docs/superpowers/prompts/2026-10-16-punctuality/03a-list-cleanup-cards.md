# Attendance → List: five cards, a plain heading, one sentence saying what the page measures (part 1 of 3)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** Two edited: `src/app/pages/attendance/AttendanceKpis.tsx`,
`src/app/pages/Attendance.tsx`. **No other file may be touched.** No migration, no action file, no
change to any loader, to `src/app/lib/attendanceStats.ts` or to `src/app/lib/reportKpis.ts`.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB.
- Presentation only: no number is calculated differently. Every value shown comes from the same
  `kpis` fields as today.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.
  (Nothing in this prompt touches dates.)

## Why (Saul, 2026-10-16)

"It's not clear what this section is about." The List is a punctuality scorecard: for the chosen
period, who arrives on time against their schedule, who is late or absent, and whether they filed
the GAF Attendance form when they were. Today it opens with ten cards and an arithmetic line, and
the table under them is headed "Employee Directory", which it is not.

This part cuts the cards to the five HR acts on, removes the arithmetic line, renames the heading
and adds one sentence at the top saying what the page measures. Parts 2 and 3 cut the phone rows
and the table.

Cards before: On-Time Rate, Late Rate, Work Days, Late Days, Avg Min Late, Absent Days, Reported,
Unreported, Time Off, Permission, plus the "On Time (x) + Late (y) … = Work Days" line.
Cards after: On-Time Rate, Late Days, Absent Days, Avg Min Late, Time Off & Permission.

The same cards show at the top of Attendance → Reports, so Reports changes the same way.

## 1. `src/app/pages/attendance/AttendanceKpis.tsx` — one edit, nothing else

`function Kpi(...)`, the imports and the `Props` type do not change. Replace the whole
`AttendanceKpis` function, which today reads

```tsx
export function AttendanceKpis({ kpis }: Props) {
  const totalCheck = kpis.onTime + kpis.lateDays + kpis.absent + kpis.excused + kpis.permission;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2 mb-1">
        <Kpi
          label="On-Time Rate"
          value={`${kpis.onTimeRate.toFixed(1)}%`}
          sub={`${kpis.onTime} of ${kpis.daysTracked} Expected`}
          tone="lead"
          color="text-secondary"
          tooltip="On-time days divided by expected days (on time + late + absent). Time off and permissions are not counted either way."
        />
        <Kpi
          label="Late Rate"
          value={`${kpis.lateRate.toFixed(1)}%`}
          sub={`${kpis.lateDays} of ${kpis.daysTracked} Expected`}
          tone="alert"
          color="text-status-yellow-ink"
          tooltip="Late days divided by expected days (on time + late + absent)."
        />
        <Kpi
          label="Work Days"
          value={`${kpis.workDays}`}
          sub="Scheduled Shifts"
          tone="plain"
          tooltip="Every day someone was scheduled on their shift in this range, including time off and permissions."
        />
        <Kpi
          label="Late Days"
          value={`${kpis.lateDays}`}
          sub={`${kpis.lateReported} Reported · ${kpis.lateUnreported} Not`}
          tone="plain"
          tooltip="Days someone clocked in after their shift start."
        />
        <Kpi
          label="Avg Min Late"
          value={`${kpis.avgMinLate.toFixed(1)}m`}
          sub="Per Late Day"
          tone="plain"
          tooltip="Average minutes late across the late days only. On-time days and absences are not included."
        />
        <Kpi
          label="Absent Days"
          value={`${kpis.absent}`}
          sub="Reported or Not"
          tone="alert"
          color="text-status-red-ink"
          tooltip="Scheduled to work with no clock-in and no time off or permission covering the day, whether or not a form was filed."
        />
        <Kpi
          label="Reported"
          value={`${kpis.reported}`}
          sub="Late/Absent, Form Filed"
          tone="plain"
          tooltip="Late or absent days with an attendance form on file."
        />
        <Kpi
          label="Unreported"
          value={`${kpis.unreported}`}
          sub="Late/Absent, No Form"
          tone="alert"
          color="text-status-red-ink"
          tooltip="Late or absent days with no attendance form on file."
        />
        <Kpi
          label="Time Off"
          value={`${kpis.excused}`}
          sub="PTO, Holidays"
          tone="plain"
          tooltip="Approved days away: PTO, company holidays, birthday and compensatory days. These never affect the score."
        />
        <Kpi
          label="Permission"
          value={`${kpis.permission}`}
          sub="Approved"
          tone="plain"
          tooltip="An approved permission covered the day. Does not affect the score."
        />
      </div>
      <div className="text-[11px] text-muted-foreground px-1">
        On Time ({kpis.onTime}) + Late ({kpis.lateDays}) + Absent ({kpis.absent}) + Time Off ({kpis.excused}) + Permission ({kpis.permission}) = {totalCheck} = Work Days ({kpis.workDays})
      </div>
    </div>
  );
}
```

with

```tsx
export function AttendanceKpis({ kpis }: Props) {
  // Absences with and without a form: each total minus its late days. No new counting.
  const absentReported = kpis.reported - kpis.lateReported;
  const absentNot = kpis.unreported - kpis.lateUnreported;
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Kpi
          label="On-Time Rate"
          value={`${kpis.onTimeRate.toFixed(1)}%`}
          sub={`${kpis.onTime} of ${kpis.daysTracked} Expected Days`}
          tone="lead"
          color="text-secondary"
          tooltip="On-time days divided by expected days (on time + late + absent). Time off and permissions are not counted either way."
        />
        <Kpi
          label="Late Days"
          value={`${kpis.lateDays}`}
          sub={`${kpis.lateReported} Reported · ${kpis.lateUnreported} Not`}
          tone="alert"
          color="text-status-yellow-ink"
          tooltip="Days someone clocked in after their shift start. Reported means a GAF Attendance form is on file for the day."
        />
        <Kpi
          label="Absent Days"
          value={`${kpis.absent}`}
          sub={`${absentReported} Reported · ${absentNot} Not`}
          tone="alert"
          color="text-status-red-ink"
          tooltip="Scheduled to work with no clock-in and no time off or permission covering the day. Reported means a GAF Attendance form is on file for the day."
        />
        <Kpi
          label="Avg Min Late"
          value={`${kpis.avgMinLate.toFixed(1)}m`}
          sub="Per Late Day"
          tone="plain"
          tooltip="Average minutes late across the late days only. On-time days and absences are not included."
        />
        <Kpi
          label="Time Off & Permission"
          value={`${kpis.excused + kpis.permission}`}
          sub={`${kpis.excused} Time Off · ${kpis.permission} Permission`}
          tone="plain"
          tooltip="Approved days away (PTO, company holidays, birthday and compensatory days) and approved permissions. These never count for or against the score."
        />
      </div>
    </div>
  );
}
```

## 2. `src/app/pages/Attendance.tsx` — two edits, nothing else

**2a.** Replace

```tsx
              <AttendanceKpis kpis={kpis} />
```

with

```tsx
              <p className="mb-3 px-1 text-sm text-slate-600">
                How often each employee arrives on time for their schedule, and whether late or absent days were reported with a GAF Attendance form.
              </p>
              <AttendanceKpis kpis={kpis} />
```

**2b.** Replace

```tsx
                    <span className="text-base font-semibold">Employee Directory</span>
```

with

```tsx
                    <span className="text-base font-semibold">Punctuality by Employee</span>
```

The loaders, their parameters, the phone/computer switch and everything else stay as they are.

## Acceptance — visible facts

1. Attendance → List on a computer: one grey sentence at the top, then **five** cards in one row,
   in this order: On-Time Rate, Late Days, Absent Days, Avg Min Late, Time Off & Permission.
   There is no line of arithmetic under the cards.
2. On-Time Rate shows the same percentage as before this change, with `x of y Expected Days`
   under it (same x and y as before).
3. Late Days shows the same count as before, with `x Reported · y Not` under it.
4. Time Off & Permission = the old Time Off card + the old Permission card.
5. The heading above the table reads `Punctuality by Employee` with the employee count beside it.
6. On a phone: the sentence, then the cards two across (the fifth alone on its row).
7. Attendance → Reports shows the same five cards at its top.
8. No console errors.

When done, reply with a one-line summary per file.
