# 08 — Hub: add jsPDF, the option lists, and the PDF's words (part 1 of 2)

> **Goes into GAF Panama HR Hub** (the Hub), not the Disciplinary Actions Form.

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.
Create the files at `app/lib/…`, never at `src/app/lib/…` (that makes a stray `src/src/`).**

**Only these 3 files may change. No other file may be touched.**

- Edit: `src/package.json` — add one dependency
- New: `src/app/lib/disciplinaryOptions.ts`
- New: `src/app/lib/disciplinaryPdf/strings.ts`

Do not edit any page, component, action, context or existing lib. Do not create
`render.ts` yet: that is the next prompt. Do not wire anything into the UI. Do not touch
`src/components/ui/` or any payroll file.

## Why

The Hub is about to let Tim and Saul edit a disciplinary warning. Saving an edit must
rebuild the PDF, and the PDF is drawn today only by the separate form app
(`src/app/utils/generatePdf.ts` in GAF Disciplinary Actions Form). The Hub gets its own copy,
English only, split into two files so each stays under 15 KB:

- `strings.ts` (this prompt) holds every word on the PDF, plus the email text. No imports.
- `render.ts` (next prompt) draws the page with jsPDF.

The code below is final. **Copy it exactly, character for character.** Do not reformat,
rename, reorder, "simplify", add comments or change quote styles. The label strings must
match the form app's exactly; a test compares them.

## 1. `src/package.json`

In `"dependencies"`, add this one line, keeping alphabetical order (it goes between
`"clsx"` and `"lucide-react"`):

```json
		"jspdf": "^2.5.2",
```

This is the same version the form app uses. Change nothing else in the file.

## 2. New file `src/app/lib/disciplinaryOptions.ts` (verbatim)

```ts
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
```

## 3. New file `src/app/lib/disciplinaryPdf/strings.ts` (verbatim)

The `\u2014` sequences are an em dash written as an escape on purpose. Keep them as the
six characters `\u2014`; do not replace them with a typed dash.

```ts
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
```

## Acceptance

- `git status` would show exactly 3 files: `package.json` changed, and the 2 new files.
- `disciplinaryOptions.ts` and `strings.ts` have **no `import` line at all**.
- `strings.ts` contains exactly 3 occurrences of `\u2014` and no typed em dash.
- `strings.ts` exports `SCENARIO_LABELS`, `DEFAULT_QUESTION_LABELS`, `questionLabels`,
  `PdfRow`, `PdfStrings`, `ymd`, `evidenceList`, `pdfFilename`, `buildPdfStrings`,
  `buildUpdatedEmail`.
- `disciplinaryOptions.ts` exports `WARNING_LEVELS` (4), `FINAL_OUTCOMES` (3, the first is
  `''`), `SCENARIOS` (5), `EVIDENCE_OPTIONS` (6).
- The app still builds and every existing page still loads (nothing uses these files yet).

## Report back

1. The three file paths as you created them, and each new file's size in bytes.
2. Confirm the `jspdf` line is in `dependencies` and that the package installed.
3. Anything you could not copy exactly, and why.

---

## Operator notes (Claude, not UIB)

After the export, byte-compare both new files against the code blocks in this prompt
(`docs/LESSONS.md`: UIB's editor drops characters from long literals). Expected sizes:
`disciplinaryOptions.ts` 1030 bytes, `strings.ts` 8430 bytes (LF line endings).
