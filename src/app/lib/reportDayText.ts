// The words behind the small marks on a day in Attendance → Reports. The only copy: the day
// tiles' mouse-over text (computer) and the day sheet (phone) both read them from here.
// Pure: a type-only import, no Date.
import type { ReportRow } from './attendanceReportTypes';

type Flags = ReportRow['flags'];

export const FLAG_NOTE = {
  recorded:  'Recorded as an unjustified absence even though a form was filed.',
  email:     'Form submitted by a different email',
  noRequest: 'Excused in payroll, no Monday request found',
  multiple:  'Multiple forms submitted',
} as const;

/** The one note behind a tile's ⓘ: the first that applies, in this order. '' when none does. */
export function infoNote(f: Flags): string {
  if (f.recordedUnexplainedButFormOnFile) return FLAG_NOTE.recorded;
  if (f.formEmailUnrecognised) return FLAG_NOTE.email;
  if (f.excusedInPayrollNoRequest) return FLAG_NOTE.noRequest;
  return '';
}

/** Every flag on the day, written out. The phone sheet lists them all. */
export function flagNotes(f: Flags): string[] {
  const out: string[] = [];
  if (f.recordedUnexplainedButFormOnFile) out.push(FLAG_NOTE.recorded);
  if (f.formEmailUnrecognised) out.push(FLAG_NOTE.email);
  if (f.excusedInPayrollNoRequest) out.push(FLAG_NOTE.noRequest);
  if (f.multipleForms) out.push(FLAG_NOTE.multiple);
  return out;
}

/** When the form was sent, against the start of the shift. */
export const formTiming = (onTime: boolean): string =>
  (onTime ? 'Form sent before the shift' : 'Form sent after the shift');
