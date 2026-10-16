// "Reported" means one thing everywhere (2026-10-16): an attendance form on file for that person on
// that day, the rule Reports and the Why tags use. Payroll's own mark (filed_gaf) is a snapshot from
// when the period was processed and misses forms filed or matched later. Pure: no runtime imports.

import type { AttendanceRow } from './attendanceStats';
import type { ReportForm } from './attendanceReportTypes';

const LATE = ['Late - Reported', 'Late - Unreported'];
const ABSENT = 'Absent - Unexplained';

/**
 * Late and absent rows get `filed_gaf` (and a late row its status) from the forms; every other row
 * is returned unchanged, and so is a row whose email has no employee id.
 */
export function reportedFromForms(
  rows: AttendanceRow[], forms: ReportForm[], idByEmail: Map<string, number>,
): AttendanceRow[] {
  const filed = new Set<string>();
  for (const f of forms ?? []) {
    if (f.employee_id == null) continue;
    const day = String(f.form_date ?? '').slice(0, 10);
    if (day) filed.add(`${Number(f.employee_id)}|${day}`);
  }
  return (rows ?? []).map(r => {
    const late = LATE.indexOf(r.status) >= 0;
    if (!late && r.status !== ABSENT) return r;
    const id = idByEmail.get(String(r.email ?? '').trim().toLowerCase());
    if (id === undefined) return r;
    const has = filed.has(`${id}|${String(r.date).slice(0, 10)}`);
    return late
      ? { ...r, status: has ? 'Late - Reported' : 'Late - Unreported', filed_gaf: has }
      : { ...r, filed_gaf: has };
  });
}

/** email (trimmed, lower case) -> employee id, from the attendance employee list. */
export function idsByEmail(employees: { email: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of employees ?? []) {
    const id = Number((e as { id?: number }).id);
    const email = String(e.email ?? '').trim().toLowerCase();
    if (email && Number.isFinite(id)) m.set(email, id);
  }
  return m;
}
