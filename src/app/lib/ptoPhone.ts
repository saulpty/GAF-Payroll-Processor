// Words for the PTO Tracker's phone rows. Pure, no imports: node tests load this file directly.
// On a computer these facts sit in mouse-over notes; on a phone they are written out.

export type FhFacts = {
  fh_left: number;
  fh_eligible_from: string | null;
  fh_used: number | string;
  fh_allocated: number | string;
  fh_sheet_used: number | string;
};

/** The note behind the FH Left number: the same words as the table's mouse-over. `day` formats a YYYY-MM-DD date. */
export function fhBreakdownText(row: FhFacts, day: (ymd: string) => string): string {
  if (row.fh_left === 0 && row.fh_eligible_from) {
    return `Eligible ${day(row.fh_eligible_from)} — 90 days after hire`;
  }
  const used = Number(row.fh_used) || 0;
  const allocated = Number(row.fh_allocated) || 2;
  const sheetUsed = Number(row.fh_sheet_used) || 0;
  return `Used ${used} of ${allocated} this year · August sheet said ${sheetUsed}`;
}

/** Why Record is switched off: the same words as the table's mouse-over. null = it can be recorded. */
export function recordBlockedText(reason: 'future' | 'not_processed' | 'invalid' | null): string | null {
  if (reason === 'future') return 'Record after the return date has passed';
  if (reason === 'not_processed') return 'Payroll for these dates has not been processed yet';
  if (reason === 'invalid') return 'Return date is before the leave date — fix the Monday request';
  return null;
}

/** "1 day", "3 days", "0.5 days". */
export function daysLabel(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** The line shown when no employee is listed. It names every filter that is on. */
export function nothingFoundText(f: {
  employee?: string | null;
  role?: string | null;
  manager?: string | null;
  chip?: 'review' | 'waiting' | null;
}): string {
  const parts: string[] = [];
  const who = (f.employee ?? '').trim();
  if (who) parts.push(/^\d+$/.test(who) ? 'the chosen employee' : `"${who}"`);
  if (f.role) parts.push(`Title: ${f.role}`);
  if (f.manager) parts.push(`Manager: ${f.manager}`);
  if (f.chip === 'review') parts.push('To Review');
  if (f.chip === 'waiting') parts.push('Not Yet');
  return parts.length > 0 ? `No employees match ${parts.join(' · ')}` : 'No employees to show';
}
