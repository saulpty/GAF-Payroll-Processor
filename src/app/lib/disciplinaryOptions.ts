// Option lists for editing a disciplinary action on the Hub.
// Copied from the form app (GAF Disciplinary Actions Form,
// src/app/utils/disciplinaryFormData.ts). The values must match it exactly:
// the form wrote these strings into disciplinary_actions, and levelRank /
// caseState in disciplinary.ts compare against them. Pure: no imports.
// The per-scenario question wording lives in disciplinaryPdf/strings.ts.

export const WARNING_LEVELS: string[] = [
  'Verbal Warning',
  'First Written Warning',
  'Second Written Warning',
  'Final Written Warning',
];

// '' means "no final outcome"; it is saved as NULL.
export const FINAL_OUTCOMES: string[] = ['', 'Suspension', 'Termination'];

export const SCENARIOS: string[] = [
  'Operational Instructions',
  'Calls / Lead Follow-up',
  'Attendance / Tardiness',
  'Inappropriate Conduct',
  'Misuse of Systems / Tools',
];

export const EVIDENCE_OPTIONS: string[] = [
  'Call Report',
  'Monday.com',
  'Attendance Record',
  'Email / Chat',
  'Witnesses',
  'Other',
];
