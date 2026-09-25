// Teramind coverage warning (Process Payroll). Saul, 2026-09-25: "why report no
// Teramind info when Monday already says he was sick". A scheduled workday is only a
// coverage gap when Teramind has nothing for it AND no Monday absence form, no
// permission and no holiday explains it. Warning-only: pay is decided by the engine.
// No imports (the page passes normalizeName and fmtDay) so node tests can load it.

type Emp = { id?: number; teramind_email: string; display_name: string };
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
  /** Normalised name or alias → employee id (ProcessPayroll's buildNameMap), as the engine uses. */
  nameMap?: Map<string, number>,
  /** Every roster teramind_email, lower-cased: an email that belongs to someone else never matches. */
  rosterEmails?: Set<string>,
): string[] {
  const empEmail = emp.teramind_email.trim().toLowerCase();
  const empName = normalize(emp.display_name);
  // Same order as the engine: this employee's email matches; someone else's email never
  // does; otherwise the name, through aliases too.
  const mine = (r: { employeeName: string; employeeEmail?: string }) => {
    const email = (r.employeeEmail ?? '').trim().toLowerCase();
    if (email && email === empEmail) return true;
    if (email && rosterEmails?.has(email)) return false;
    const n = normalize(r.employeeName ?? '');
    return (emp.id !== undefined && nameMap?.get(n) === emp.id) || n === empName;
  };
  const absent = new Set(attendance.filter(r => r.type === 'Absence' && mine(r)).map(r => r.date.slice(0, 10)));
  const perms = permissions.filter(mine);
  return expectedWorkdays.filter(d =>
    !teramindDays.has(d) && !holidayDates.has(d) && !absent.has(d) &&
    !perms.some(p => d >= p.startDate.slice(0, 10) && d <= p.endDate.slice(0, 10)));
}
