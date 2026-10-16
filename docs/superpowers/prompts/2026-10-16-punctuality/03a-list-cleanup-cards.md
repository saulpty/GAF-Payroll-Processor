<!--
DRAFT for Saul. Not sent. DELETE THIS COMMENT BLOCK BEFORE PASTING.
Three parts, in order: 03a cards and heading, 03b phone rows (+ the new On-Time pill),
03c computer table. Each part leaves the app compiling on its own. Send one, export, sync,
check, then the next. Test: tests/listCleanup.test.ts (fails until all three are exported).

OPEN QUESTIONS FOR SAUL, for all three parts (the drafts use the first option of each):

Q1. The five cards are shared with Attendance → Reports. The same card component draws the top of
    both tabs (Reports was built to show "the same ten top cards the List tab shows"). This draft
    changes BOTH tabs to five cards. The other option is to leave Reports on ten, which needs a
    second copy of the cards. Recommendation: both, so the two tabs keep matching.

Q2. Absent Days card, small line "x Reported · y Not". On Reports this is a real split (a filed
    absence is counted as reported). On the List, the payroll view only marks an absence it could
    not explain, so the List will almost always read "0 Reported · N Not". Option A (this draft):
    show the split on both. Option B: keep today's wording "Reported or Not" on the card.

Q3. Late Rate goes away. It was Late Days ÷ Expected Days. The card is gone but nothing is lost:
    the count is on Late Days and the rate is 100% minus On-Time minus absences. OK to drop?

Q4. Work Days and the arithmetic line under the cards go away ("On Time + Late + Absent + Time Off
    + Permission = Work Days"). They were a self-check, not something HR acts on. OK to drop?

Q5. Good / Fair / At Risk (03b, 03c). Those words come from % On-Time alone (90%+, 75-89%, below
    75%), so the "Status" column repeated the % column in words. The drafts keep the colours (a
    green / amber / red bar on a computer, a coloured "92% On Time" pill on a phone) and drop the
    words. Option B: keep the words in a small pill next to the bar. Do you or the managers use
    "At Risk" when talking to people?

Q6. "Avg Min Late" (03c). The table column is NOT the same number as the "Avg Min Late" card. The
    card averages the late days only; the column averages every day the person worked, on-time days
    included, so it reads lower. The draft keeps the column's honest name "Avg Min (Worked)" rather
    than rename it, because this cleanup must not change what any number means. Making the column
    match the card is a calculation change and would be its own prompt. Want that later?

Q7. Columns dropped (03c): Role (the filter bar already filters by title), Expected, On Time
    (count), Reported, Unreported (now a red "x Not Reported" under Late), and the 1-10m / 11-30m /
    31+m buckets. The panel that opens on a click still shows Expected, On Time, Reported and
    Unreported for one person. Is any dropped column something you look at every week?

Q8. Phone rows (03b) keep the title under the name (there is room) though the computer table drops
    the Role column. Fine, or drop it on the phone too?

Q9. The page sentence (03a): "How often each employee arrives on time for their schedule, and
    whether late or absent days were reported with a GAF Attendance form." Wording OK?
-->

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
