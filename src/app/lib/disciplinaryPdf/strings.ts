// Disciplinary PDF: the words. The English half of the form app's
// generatePdf.ts (GAF Disciplinary Actions Form, src/app/utils/generatePdf.ts).
// Every label must stay identical to the form's, character for character, so
// the Hub's rebuilt PDF reads exactly like the one the manager filed.
// Pure: no imports, no React, no jsPDF, no Date. Dates are 'YYYY-MM-DD' strings.

// The four incident questions, worded per scenario. Copied from the form's
// disciplinaryFormData.ts. Used as the PDF labels and the edit form's labels.
export const DEFAULT_QUESTION_LABELS: [string, string, string, string] = [
  'Expected behavior',
  'What happened',
  'When',
  'Impact',
];

export const SCENARIO_LABELS: Record<string, [string, string, string, string]> = {
  'Operational Instructions': [
    'What was the employee instructed or expected to do?',
    'What actually happened?',
    'When did it happen?',
    'How did this affect the operation or the team?',
  ],
  'Calls / Lead Follow-up': [
    'What was the employee instructed or expected to do? (include specific numbers)',
    'What actually happened? (include specific numbers from the report)',
    'When did it happen?',
    'How did this affect the operation?',
  ],
  'Attendance / Tardiness': [
    "What was the employee's scheduled attendance requirement?",
    'What actually happened?',
    'When did it happen?',
    'How did this affect the operation?',
  ],
  'Inappropriate Conduct': [
    'What professional conduct standard applies?',
    'What actually happened? (be specific - quote exact words if applicable)',
    'When and where did it happen?',
    'How did this affect the team or working environment?',
  ],
  'Misuse of Systems / Tools': [
    'What policy or procedure was the employee expected to follow?',
    'What actually happened?',
    'When did it happen?',
    'How did this affect the company or clients?',
  ],
};

/** The four question labels for a scenario; unknown or empty falls back to the defaults. */
export function questionLabels(scenario: string | null | undefined): [string, string, string, string] {
  return (scenario && SCENARIO_LABELS[scenario]) || DEFAULT_QUESTION_LABELS;
}

/** One disciplinary_actions row, snake_case, as loadDisciplinaryActions returns it. */
export interface PdfRow {
  ref: string;
  employee_name: string;
  manager_name?: string | null;
  manager_email?: string | null;
  employee_role?: string | null;
  employee_branch?: string | null;
  document_date?: string | null;
  revaluation_date?: string | null;
  warning_level?: string | null;
  final_outcome?: string | null;
  scenario?: string | null;
  q_expected?: string | null;
  q_happened?: string | null;
  q_when?: string | null;
  q_impact?: string | null;
  evidence_types?: string[] | string | null;
  evidence_description?: string | null;
  prior_warnings?: string | null;
  expectations?: string | null;
  consequences?: string | null;
}

export interface PdfStrings {
  formTitle: string;
  confidentialLabel: string;
  dateLabel: string;
  metaEmployee: string;
  metaRole: string;
  metaBranch: string;
  metaSupervisor: string;
  metaSupEmail: string;
  metaRevalDate: string;
  warnLevelLabel: string;
  warningDisplay: string;
  situationTypeHeading: string;
  scenarioValue: string;
  incidentHeading: string;
  incLabel0: string;
  incValue0: string;
  incLabel1: string;
  incValue1: string;
  incLabel2: string;
  incValue2: string;
  incLabel3: string;
  incValue3: string;
  evidenceReviewedLabel: string;
  evidenceDescLabel: string;
  evidenceDescValue: string;
  priorWarnLabel: string;
  priorWarnValue: string;
  correctiveHeading: string;
  correctiveLabel: string;
  correctiveValue: string;
  finalOutcomeLabel: string;
  finalOutcomeValue: string;
  showFinalOutcome: boolean;
  noticeText: string;
  consequencesLabel: string;
  consequencesValue: string;
  sigHeading: string;
  sigSubtext: string;
  sigEmployeeRole: string;
  sigManagement: string;
  sigDateLine: string;
  footerText: string;
  filename: string;
}

/** Postgres can hand back a full timestamp; the PDF prints YYYY-MM-DD. */
export function ymd(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : '';
}

/** text[] normally arrives as an array; also accept the '{a,"b c"}' text form. */
export function evidenceList(v: string[] | string | null | undefined): string[] {
  if (Array.isArray(v)) return v.map(String).filter(s => s.trim() !== '');
  if (!v) return [];
  return String(v)
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map(s => s.trim().replace(/^"|"$/g, ''))
    .filter(s => s !== '');
}

export function pdfFilename(ref: string): string {
  return `GAF_Disciplinary_Action_EN_${ref}.pdf`;
}

export function buildPdfStrings(row: PdfRow): PdfStrings {
  const scenario = row.scenario ?? '';
  const labels = questionLabels(scenario);
  const level = row.warning_level ?? '';
  const outcome = row.final_outcome ?? '';
  const date = ymd(row.document_date);
  return {
    formTitle: 'DISCIPLINARY ACTION FORM',
    confidentialLabel: 'CONFIDENTIAL',
    dateLabel: 'Date',
    metaEmployee: 'EMPLOYEE',
    metaRole: 'ROLE',
    metaBranch: 'BRANCH',
    metaSupervisor: 'SUPERVISOR',
    metaSupEmail: 'SUPERVISOR EMAIL',
    metaRevalDate: 'RE-EVALUATION DATE',
    warnLevelLabel: 'DISCIPLINARY ACTION LEVEL',
    warningDisplay: level + (outcome ? ` \u2014 ${outcome}` : ''),
    situationTypeHeading: 'Situation Type',
    scenarioValue: scenario || '\u2014',
    incidentHeading: 'Incident Documentation',
    incLabel0: labels[0],
    incValue0: row.q_expected ?? '',
    incLabel1: labels[1],
    incValue1: row.q_happened ?? '',
    incLabel2: labels[2],
    incValue2: row.q_when ?? '',
    incLabel3: labels[3],
    incValue3: row.q_impact ?? '',
    evidenceReviewedLabel: 'Evidence Reviewed',
    evidenceDescLabel: 'Evidence Description',
    evidenceDescValue: row.evidence_description ?? '',
    priorWarnLabel: 'Prior Warnings or Discussions',
    priorWarnValue: row.prior_warnings ?? '',
    correctiveHeading: 'Corrective Action & Expectations',
    correctiveLabel: 'What the employee must correct starting today',
    correctiveValue: row.expectations ?? '',
    finalOutcomeLabel: 'Final Outcome',
    finalOutcomeValue: outcome,
    showFinalOutcome: !!outcome,
    noticeText:
      'The employee is hereby warned that recurrence, failure to correct, or non-compliance with the instructions outlined above may result in further disciplinary action, up to and including suspension or termination of employment, in accordance with the Internal Work Regulations and applicable labor law.',
    consequencesLabel: 'Consequences of Non-compliance',
    consequencesValue: row.consequences ?? '',
    sigHeading: 'Signatures & Acknowledgment',
    sigSubtext: 'The employee was heard and had the opportunity to present comments.',
    sigEmployeeRole: 'Employee',
    sigManagement: 'Management',
    sigDateLine: 'Date: ______________________',
    footerText: `The employee's signature does not imply acceptance of fault. It only confirms receipt of the document.  |  cc. Personnel file  |  ${row.ref}  |  ${date}`,
    filename: pdfFilename(row.ref),
  };
}

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Subject and HTML body for the "this warning was edited" email. */
export function buildUpdatedEmail(
  row: PdfRow,
  editedBy: string,
  editedOn: string,
): { subject: string; html: string } {
  const date = ymd(row.document_date);
  return {
    subject: `UPDATED \u2014 Disciplinary Action - ${row.employee_name} - ${date}`,
    html:
      `<p>Dear ${esc(row.manager_name)},</p>` +
      `<p>The disciplinary action for employee <strong>${esc(row.employee_name)}</strong> ` +
      `was <strong>updated</strong> by ${esc(editedBy)} on ${esc(editedOn)}.</p>` +
      `<ul><li><strong>Reference:</strong> ${esc(row.ref)}</li>` +
      `<li><strong>Warning Level:</strong> ${esc(row.warning_level)}</li>` +
      `<li><strong>Document Date:</strong> ${esc(date)}</li>` +
      `<li><strong>Re-evaluation Date:</strong> ${esc(ymd(row.revaluation_date))}</li></ul>` +
      `<p>The updated document is attached as a PDF and replaces the earlier version.</p>` +
      `<p>GAF Healthcare Services Panama</p>`,
  };
}
