# Punctuality and Reports for employees outside payroll, part 1 of 2 (helpers, loader, type)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Employees whose `country` is not the payroll country (the international agents) never get a
payroll row. On Attendance → Punctuality and Reports, days come from payroll rows for periods
payroll has processed, and from Teramind only for days after the newest processed period. So in a
processed period every day of theirs reads "Not Run Yet · No punches". For them every date is
"live": it should always come from Teramind.

This part adds the pieces only. **Nothing on any page changes after this part**; part 2 wires them.
For payroll employees nothing is ever computed differently: the helpers run the existing code
exactly as today and only replace the outside-payroll employees' rows.

**Only these files may change:** `src/actions/loadAttendanceEmployees.ts`,
`src/app/lib/attendanceReportTypes.ts`, `src/app/lib/liveAttendance.ts`,
`src/app/lib/liveListRows.ts`. **No other file may be touched.** In particular do not edit
`attendanceReport.ts`, `AttendanceReport.tsx` or `useLiveListRows.ts` in this part.

Rules:
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- `liveAttendance.ts` and `liveListRows.ts` keep **no runtime imports** (only `import type`).
- Dates stay `YYYY-MM-DD` strings compared as strings; no `Date` objects.
- Every file stays under 15 KB. Keep the `v_employee_access` filter in the loader exactly as it is.

## 1. `src/actions/loadAttendanceEmployees.ts`

Directly after the line
`        COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days,`
add these two lines:

```sql
        COALESCE(e.country, 'Panama') AS country,
        (COALESCE(e.country, 'Panama') = COALESCE(NULLIF((SELECT c.value FROM classification_config c WHERE c.key = 'payroll_country'), ''), 'Panama')) AS in_payroll,
```

Nothing else in the query changes.

## 2. `src/app/lib/attendanceReportTypes.ts`

In `ReportEmployee`, after the line `  grace_minutes: number;` add:

```ts
  /** false = outside payroll (country is not payroll_country): every date is live for them. */
  in_payroll?: boolean;
```

## 3. `src/app/lib/liveAttendance.ts`, append at the end of the file

```ts

// 2026-10-16 (international agents): employees outside payroll (in_payroll === false, their
// country is not payroll_country) never get a payroll row, so EVERY date in the range is live
// for them. `wide` is that range: liveWindow([], dateFrom, dateTo, today).

/** Ids of the employees outside payroll. */
export function outsidePayrollIds(employees: ReportEmployee[]): Set<string> {
  return new Set((employees ?? []).filter(e => e.in_payroll === false).map(e => String(e.id)));
}

/**
 * liveReport exactly as before for everyone, then the outside-payroll employees' rows and totals
 * are replaced by a liveReport over `wide`. Payroll employees' rows and totals are untouched.
 */
export function liveReportWithOutside(a: {
  input: ReportInput; main: ReportOutput; window: LiveWindow | null; wide: LiveWindow | null;
  today: string; tmRows: ActivityDayRow[]; build(input: ReportInput): ReportOutput;
}): ReportOutput {
  const base = liveReport(a);
  const ids = outsidePayrollIds(a.input.employees);
  if (!a.wide || ids.size === 0) return base;
  const mine = (id: unknown) => ids.has(String(id));
  const input: ReportInput = {
    ...a.input,
    employees: (a.input.employees ?? []).filter(e => mine(e.id)),
    payrollRows: (a.input.payrollRows ?? []).filter(p => mine(p.employee_id)),
  };
  const out = liveReport({
    input, main: a.build(input), window: a.wide, today: a.today, tmRows: a.tmRows, build: a.build,
  });
  const rows = [...base.rows.filter(r => !mine(r.employeeId)), ...out.rows];
  rows.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.employeeName.localeCompare(y.employeeName)));
  const theirs = new Map(out.perEmployee.map(s => [String(s.employeeId), s]));
  const perEmployee = base.perEmployee.map(s => theirs.get(String(s.employeeId)) ?? s);
  return { rows, perEmployee, unmatchedForms: base.unmatchedForms };
}
```

## 4. `src/app/lib/liveListRows.ts`, append at the end of the file

```ts

/**
 * 2026-10-16 (international agents): employees outside payroll (in_payroll === false) take their
 * List rows from `wide`, the whole range (payroll never processes their days). Everyone else
 * gets exactly what liveListRows gives today.
 */
export function liveListRowsWithOutside(
  input: Parameters<typeof liveListRows>[0] & { wide: LiveWindow | null },
): AttendanceRow[] {
  const others = (input.employees ?? []).filter(e => e.in_payroll === false);
  const base = liveListRows(input);
  if (!input.wide || others.length === 0) return base;
  const emails = new Set(others.map(e => String(e.email ?? '').trim().toLowerCase()));
  const mine = (r: AttendanceRow) => emails.has(String(r.email ?? '').trim().toLowerCase());
  return [...base.filter(r => !mine(r)), ...liveListRows({ ...input, employees: others, window: input.wide })];
}
```

Reply with the diff of the four files.
