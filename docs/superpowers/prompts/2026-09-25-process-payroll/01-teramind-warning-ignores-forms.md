# Process Payroll: the Teramind coverage warning ignores days a Monday form explains

**Copy every code block exactly. Do not rewrite or re-derive anything from the description.
If your context is compacted mid-task, re-read this prompt before writing.**

**Only these two files may change:**
1. **New** `src/app/lib/teramindCoverage.ts` (section A).
2. `src/app/pages/ProcessPayroll.tsx`: two import lines added and one block replaced (section B).
   This is a high-blast-radius payroll file: change nothing else, do not reformat.

Not touched: `classificationEngine.ts` (only `normalizeName`, already imported, is passed in),
the engine run, any action, anything that decides pay. This changes a **warning message only**.

## Why
Saul, 2026-09-25: the run warned "Carlos Aloma: Teramind covers only 6/10 workdays" although
Monday had sick forms for three of the four missing days. A workday is now a coverage gap only
when Teramind has nothing for it **and** no Monday absence form, no permission and no holiday
explains it; the warning lists those days, e.g.
`Carlos Aloma: no Teramind data and no form on 4 of 10 workdays: Wed Sep 16, Thu Sep 17, …`.

## A. New `src/app/lib/teramindCoverage.ts`

```ts
// Teramind coverage warning (Process Payroll). Saul, 2026-09-25: "why report no
// Teramind info when Monday already says he was sick". A scheduled workday is only a
// coverage gap when Teramind has nothing for it AND no Monday absence form, no
// permission and no holiday explains it. Warning-only: pay is decided by the engine.
// No imports (the page passes normalizeName and fmtDay) so node tests can load it.

type Emp = { teramind_email: string; display_name: string };
type Attendance = { employeeName: string; employeeEmail?: string; date: string; type: string };
type Permission = { employeeName: string; employeeEmail?: string; startDate: string; endDate: string };

/** Scheduled workdays (YYYY-MM-DD) with no Teramind data and nothing on Monday or the calendar explaining them. */
export function unexplainedWorkdays(
  emp: Emp,
  expectedWorkdays: string[],
  teramindDays: { has: (d: string) => boolean },
  holidayDates: Set<string>,
  attendance: Attendance[],
  permissions: Permission[],
  normalize: (s: string) => string,
): string[] {
  const empEmail = emp.teramind_email.trim().toLowerCase();
  const empName = normalize(emp.display_name);
  // Email first; a missing or unknown email falls back to the normalised name.
  const mine = (r: { employeeName: string; employeeEmail?: string }) => {
    const email = (r.employeeEmail ?? '').trim().toLowerCase();
    return (!!email && email === empEmail) || normalize(r.employeeName ?? '') === empName;
  };
  const absent = new Set(attendance.filter(r => r.type === 'Absence' && mine(r)).map(r => r.date.slice(0, 10)));
  const perms = permissions.filter(mine);
  return expectedWorkdays.filter(d =>
    !teramindDays.has(d) && !holidayDates.has(d) && !absent.has(d) &&
    !perms.some(p => d >= p.startDate.slice(0, 10) && d <= p.endDate.slice(0, 10)));
}
```

## B. `src/app/pages/ProcessPayroll.tsx`

1. Directly after the line
   `import { normalizePeriodName, isCanonical, nearMatch, nextPeriod, periodNameFromEndDate } from '@/app/lib/periodName';`
   add these two lines:
   ```ts
   import { fmtDay } from '@/app/lib/fmtDay';
   import { unexplainedWorkdays } from '@/app/lib/teramindCoverage';
   ```
2. In `handleRun`, replace this exact block (currently lines 391–400):
   ```ts
         for (const emp of activeEmps) {
           if (!emp.teramind_email) continue;
           const dayMap = tmMap.get(emp.teramind_email.toLowerCase());
           if (!dayMap) continue;
           const expectedWorkdays = periodDates.filter(d => isScheduledWorkDay(d, emp.work_days)).map(d => toLocalYMD(d));
           if (expectedWorkdays.length === 0) continue;
           const covered = expectedWorkdays.filter(d => dayMap.has(d)).length;
           const gap = expectedWorkdays.length - covered;
           if (gap > 0 && gap / expectedWorkdays.length > 0.3) warnings.push({ level: 'warn', message: `${emp.display_name}: Teramind covers only ${covered}/${expectedWorkdays.length} workdays.` });
         }
   ```
   with:
   ```ts
         // A workday is a Teramind gap only when no Monday absence form, permission or holiday
         // explains it (Saul, 2026-09-25: sick days were being reported as missing Teramind data).
         const holidayDates = new Set((holidays as { date: string }[]).map(h => String(h.date).slice(0, 10)));
         for (const emp of activeEmps) {
           if (!emp.teramind_email) continue;
           const dayMap = tmMap.get(emp.teramind_email.toLowerCase());
           if (!dayMap) continue;
           const expectedWorkdays = periodDates.filter(d => isScheduledWorkDay(d, emp.work_days)).map(d => toLocalYMD(d));
           if (expectedWorkdays.length === 0) continue;
           const gaps = unexplainedWorkdays(emp, expectedWorkdays, dayMap, holidayDates, attendance, permissions, normalizeName);
           if (gaps.length > 0 && gaps.length / expectedWorkdays.length > 0.3) warnings.push({ level: 'warn', message: `${emp.display_name}: no Teramind data and no form on ${gaps.length} of ${expectedWorkdays.length} workdays: ${gaps.map(d => fmtDay(d, d.slice(0, 4))).join(', ')}.` });
         }
   ```
   `holidays`, `attendance`, `permissions`, `tmMap`, `periodDates` and `activeEmps` are already in
   scope there.

## Report
- The byte size of both files, and the two changed places in `ProcessPayroll.tsx` as they now read.
- Confirm no other file changed.
