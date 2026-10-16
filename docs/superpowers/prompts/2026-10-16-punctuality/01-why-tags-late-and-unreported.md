# Why tags: no "Tardiness" on an on-time day, a red "Not Reported" on a late day with no form

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** Six edited:
`src/app/lib/activityTypes.ts`, `src/app/lib/activityDays.ts`,
`src/app/pages/attendance/activity/WhyChipBadge.tsx`, `src/app/pages/attendance/TodayRow.tsx`,
`src/app/pages/attendance/useTodayWhy.ts`, `src/app/pages/attendance/AttendanceToday.tsx`.
**No other file may be touched.** No migration, no action file. In particular do NOT touch
`AttendancePanelDays.tsx`, `AttendancePanelDayRows.tsx`, `AttendancePanelBody.tsx`,
`AttendanceDonuts.tsx`, `useEmployeeStats.ts`, `AttendancePanel.tsx`, `src/app/pages/Attendance.tsx`,
`AttendanceKpis.tsx`, `AttendanceTable.tsx`, `AttendanceListRows.tsx`, `attendanceStats.ts`,
`attendanceSort.ts`, `liveAttendance.ts`, `liveListRows.ts` or `attendanceReport.ts`. They already
draw the Why tag through `WhyChipBadge` and need no change.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB. `activityDays.ts` must keep **no runtime imports** (type imports
  only) — the tests load it directly.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.
  Times here are minutes since midnight; no `Date` object is needed or allowed in these edits.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

## Why (Saul, 2026-10-16)

Nichole Harris works 9:00 AM–5:00 PM. Her Why column read **Tardiness** on Mon Oct 12 (in at
8:57 AM) and Thu Oct 15 (in at 8:56 AM) — days she was on time — only because a Tardiness form was
on file. A manager skimming the column thinks she was late more often than she was.

The cause is `whyFor()` in `activityDays.ts`: whenever the day has a form it shows the form's type,
without asking whether the person was late.

From now on:

1. A **Tardiness** form on a day the person came in **on time** shows **no tag**. The day reads as
   a normal on-time day. Sick forms, other form types (Absence…) and any form on a day with no
   punches show exactly as today.
2. A day the person **was late** and has **no form** shows a red **Not Reported** tag. (The panel's
   Status column used to say "Late - Unreported"; another prompt is removing that.)
3. A late day **with** a form shows the form tag, as today.

"Late" means what it means everywhere else in the app, through one new helper, `minutesLateFor`:

- A day with a payroll row: payroll's own late minutes (`rr.minutesLate`, which is
  `late_minutes` = entry − scheduled start; grace changes the pay, not whether they were late).
- A live day (payroll has not run): the first Teramind record against the scheduled start — the
  exact number `liveAttendance.livePayrollRows` writes as `late_minutes` for Attendance List and
  Reports. On Attendance → Today, that first record is the row's `entryMin`, which
  `teramindToday` also measures against the scheduled start.

Everything that shows the Why tag gets this at once: Activity → By Day, Needs a Look, the Activity
phone rows, the employee panel's Day by Day table and phone rows, and Attendance → Today.

## 1. `src/app/lib/activityTypes.ts` — one edit, nothing else

Replace

```ts
export type WhyKind = 'pto' | 'permission' | 'sick' | 'form' | 'holiday' | 'wfh' | 'day_off' | 'none';
export type WhyChip = { kind: WhyKind; label: string; tone: 'blue' | 'amber' | 'gray' };
```

with

```ts
export type WhyKind = 'pto' | 'permission' | 'sick' | 'form' | 'holiday' | 'wfh' | 'day_off' | 'none' | 'unreported';
export type WhyChip = { kind: WhyKind; label: string; tone: 'blue' | 'amber' | 'gray' | 'red' };
```

## 2. `src/app/lib/activityDays.ts` — four edits, nothing else

**2a.** Replace

```ts
const chip = (kind: WhyKind, label: string, tone: WhyChip['tone'] = 'blue'): WhyChip => ({ kind, label, tone });
```

with

```ts
const chip = (kind: WhyKind, label: string, tone: WhyChip['tone'] = 'blue'): WhyChip => ({ kind, label, tone });
const TARDINESS_FORM = /tardiness|tardanza/;
// Minutes late as payroll counts them (entry - start; grace is pay). Payroll row: its minutes.
// Live day: first Teramind record vs scheduled start, as liveAttendance.livePayrollRows.
export function minutesLateFor(rr: ReportRow | null, firstMin: number | null, scheduleStart = ''): number {
  if (rr && (rr.verdict !== 'not_processed' || rr.entryTime != null)) return Math.max(0, Number(rr.minutesLate) || 0);
  const start = parseClock(rr ? rr.scheduledStart : '') ?? parseClock(scheduleStart);
  return firstMin !== null && start !== null ? Math.max(0, firstMin - start) : 0;
}
```

**2b.** Replace

```ts
  scheduled: boolean; hasActivity: boolean;
}): WhyChip | null {
```

with

```ts
  scheduled: boolean; hasActivity: boolean;
  firstMin?: number | null; scheduleStart?: string;   // live days: first record, own start
}): WhyChip | null {
```

**2c.** Replace

```ts
  if (rr && rr.form) {
    const type = String(rr.form.type ?? '').trim();
    // "Absence" with reason "Sick" is a sick day: the reason is the why.
    if (SICK_FORM.test(`${type} ${rr.form.reason ?? ''}`.toLowerCase())) return chip('sick', 'Sick');
    return chip('form', titleCase(type) || 'Form');
  }
```

with

```ts
  const late = args.hasActivity && minutesLateFor(rr, args.firstMin ?? null, args.scheduleStart ?? '') > 0;
  if (rr && rr.form) {
    const type = String(rr.form.type ?? '').trim();
    // "Absence" with reason "Sick" is a sick day: the reason is the why.
    if (SICK_FORM.test(`${type} ${rr.form.reason ?? ''}`.toLowerCase())) return chip('sick', 'Sick');
    // On time with a Tardiness form: no tag (2026-10-16).
    if (!(args.hasActivity && !late && TARDINESS_FORM.test(type.toLowerCase()))) return chip('form', titleCase(type) || 'Form');
  } else if (args.scheduled && late) {
    return chip('unreported', 'Not Reported', 'red');   // was "Late - Unreported"
  }
```

The holiday / PTO / permission branch above it, and the WFH / Day Off / No Reports Yet lines below
it, do not change. An on-time Tardiness day simply carries on to those lines (usually ending with
no tag).

**2d.** Replace

```ts
      const why = whyFor({ reportRow: rr, requests: empRequests, scheduled, hasActivity });
```

with

```ts
      const why = whyFor({ reportRow: rr, requests: empRequests, scheduled, hasActivity, firstMin, scheduleStart: emp.schedule_start });
```

`firstMin` is the variable already declared a few lines above in the same loop. Nothing else in
`buildActivityDays` changes (flags, Needs a Look, `lateArrivals`, totals all stay as they are).

## 3. `src/app/pages/attendance/activity/WhyChipBadge.tsx` — one edit, nothing else

Replace

```tsx
  gray:  'bg-slate-100 text-slate-600 border-slate-200',
```

with

```tsx
  gray:  'bg-slate-100 text-slate-600 border-slate-200',
  red:   'bg-status-red-fill text-status-red-ink border-transparent',
```

## 4. `src/app/pages/attendance/TodayRow.tsx` — one edit, nothing else

Replace

```tsx
  gray:  'bg-slate-100 text-slate-500 border-slate-200',
```

with

```tsx
  gray:  'bg-slate-100 text-slate-500 border-slate-200',
  red:   'bg-status-red-fill text-status-red-ink border-transparent',
```

(The same red as the "No Records" status pill. `ON_LEAVE_KINDS` does not change: Not Reported is
never "on leave".)

## 5. `src/app/pages/attendance/useTodayWhy.ts` — four edits, nothing else

**5a.** Replace

```ts
  hasActivityById: Map<number, boolean>;
```

with

```ts
  hasActivityById: Map<number, boolean>;
  /** First record per employee (minutes since midnight), so whyFor can tell late from on time. */
  entryMinById?: Map<number, number | null>;
```

**5b.** Replace

```ts
  const { day, employees, scheduledById, hasActivityById } = args;
```

with

```ts
  const { day, employees, scheduledById, hasActivityById, entryMinById } = args;
```

**5c.** Replace

```ts
      result.set(eid, whyFor({ reportRow, requests: empReqs, scheduled, hasActivity }));
```

with

```ts
      result.set(eid, whyFor({ reportRow, requests: empReqs, scheduled, hasActivity, firstMin: entryMinById?.get(eid) ?? null }));
```

**5d.** Replace

```ts
  }, [loading, day, employees, rawDays, rawForms, rawRequests, rawHolidays, rawPeriods, rawDst, scheduledById, hasActivityById]);
```

with

```ts
  }, [loading, day, employees, rawDays, rawForms, rawRequests, rawHolidays, rawPeriods, rawDst, scheduledById, hasActivityById, entryMinById]);
```

## 6. `src/app/pages/attendance/AttendanceToday.tsx` — two edits, nothing else

**6a.** Replace

```tsx
  // employees cast to ReportEmployee for useTodayWhy
```

with

```tsx
  const entryMinById = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const r of allRows) m.set(r.employeeId, r.entryMin);
    return m;
  }, [allRows]);

  // employees cast to ReportEmployee for useTodayWhy
```

**6b.** Replace

```tsx
    scheduledById,
    hasActivityById,
  });
```

with

```tsx
    scheduledById,
    hasActivityById,
    entryMinById,
  });
```

`useMemo` is already imported. Nothing else on the page changes.

## Acceptance — visible facts

1. Attendance → Activity → By Day, filtered to **Nichole Harris**, Oct 12–15: Mon Oct 12 (in
   8:57 AM) and Thu Oct 15 (in 8:56 AM) show **no** Why tag. Open her panel: the Day by Day table
   shows the same — no "Tardiness" on those two days.
2. Any day someone was late with no form on file shows a **red "Not Reported"** tag in Why — in
   By Day, Needs a Look (if the day is flagged), the panel's Day by Day, and on a phone.
3. A late day with a Tardiness form still shows **Tardiness** (blue). Sick days still read
   **Sick**; PTO, Permission, Holiday, WFH, Day Off and No Reports Yet are unchanged.
4. Attendance → Today: someone who came in after their start with no form shows **Not Reported**;
   someone on time with a Tardiness form shows no tag. People with No Records and a form still read
   **On Leave**.
5. No console errors; no file other than the six above changed.

When done, reply with a one-line summary per file.
