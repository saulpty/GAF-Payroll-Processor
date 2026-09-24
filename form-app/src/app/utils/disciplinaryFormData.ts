export type WarnLevel = 'Verbal Warning' | 'First Written Warning' | 'Second Written Warning' | 'Final Written Warning';
export type FinalOutcome = 'Suspension' | 'Termination' | '';
export type ScenarioType =
  | 'Operational Instructions'
  | 'Calls / Lead Follow-up'
  | 'Attendance / Tardiness'
  | 'Inappropriate Conduct'
  | 'Misuse of Systems / Tools'
  | '';

export type EvidenceType = 'Call Report' | 'Monday.com' | 'Attendance Record' | 'Email / Chat' | 'Witnesses' | 'Other';

export interface DisciplinaryFormData {
  // Step 1
  managerName: string;
  managerEmail: string;
  documentDate: string;
  employeeName: string;
  employeeRole: string;
  employeeBranch: string;
  warningLevel: WarnLevel | '';
  finalOutcome: FinalOutcome;
  // Step 2
  scenario: ScenarioType;
  qExpected: string;
  qHappened: string;
  qWhen: string;
  qImpact: string;
  evidenceTypes: EvidenceType[];
  evidenceDescription: string;
  // Step 3
  priorWarnings: string;
  expectations: string;
  consequences: string;
  revaluationDate: string;
  // Step 4
  signatureDrawn: boolean;
}

// Today as YYYY-MM-DD in the browser's LOCAL time (Panama). Never toISOString():
// that is UTC, and after 7 pm in Panama it is already tomorrow.
export function todayLocalYMD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const INITIAL_FORM: DisciplinaryFormData = {
  managerName: '',
  managerEmail: '',
  documentDate: '', // set to todayLocalYMD() when the form is created
  employeeName: '',
  employeeRole: '',
  employeeBranch: '',
  warningLevel: '',
  finalOutcome: '',
  scenario: '',
  qExpected: '',
  qHappened: '',
  qWhen: '',
  qImpact: '',
  evidenceTypes: [],
  evidenceDescription: '',
  priorWarnings: '',
  expectations: '',
  consequences: '',
  revaluationDate: '',
  signatureDrawn: false,
};

export const SCENARIO_DESCRIPTIONS: Record<Exclude<ScenarioType, ''>, string> = {
  'Operational Instructions': 'Employee did not follow a direct instruction or assigned function',
  'Calls / Lead Follow-up': 'Did not meet call minimums, follow up on leads, or update Monday.com',
  'Attendance / Tardiness': 'Late arrival, absence, no clock-in, or unauthorized departure',
  'Inappropriate Conduct': 'Disrespectful behavior, inappropriate language, or workplace conflict',
  'Misuse of Systems / Tools': 'Incorrect use of Monday.com, systems, client data, or confidential info',
};

export const SCENARIO_EMOJIS: Record<Exclude<ScenarioType, ''>, string> = {
  'Operational Instructions': '📋',
  'Calls / Lead Follow-up': '📞',
  'Attendance / Tardiness': '🕐',
  'Inappropriate Conduct': '⚠️',
  'Misuse of Systems / Tools': '💻',
};

export type QuestionKey = 'qExpected' | 'qHappened' | 'qWhen' | 'qImpact';

export const SCENARIO_PLACEHOLDERS: Record<Exclude<ScenarioType, ''>, Record<QuestionKey, string>> = {
  'Operational Instructions': {
    qExpected: 'e.g. The employee was instructed on May 15 to review Monday.com daily and update all assigned cases before end of shift.',
    qHappened: 'e.g. The employee did not review Monday.com or update their assigned cases on May 20, 21, and 23 despite receiving explicit instructions.',
    qWhen: 'e.g. May 20, 21, and 23, 2025.',
    qImpact: 'e.g. 4 client cases remained without follow-up for over 72 hours, causing delays in onboarding.',
  },
  'Calls / Lead Follow-up': {
    qExpected: 'e.g. Complete a minimum of 90 calls per day, submit referrals as soon as information is available, and update all leads in Monday.com daily.',
    qHappened: 'e.g. Employee completed only 43 calls on May 23. Monday.com shows 6 leads untouched since March, including 2 marked Hot Lead. 3 referrals had all required information but were not submitted.',
    qWhen: 'e.g. Week of May 19-23, 2025. Most critical day: May 23.',
    qImpact: 'e.g. Potential clients were not followed up on timely, reducing the department\'s referral intake for the week.',
  },
  'Attendance / Tardiness': {
    qExpected: 'e.g. Scheduled shift starts at 8:00 AM. Per company policy, employees must be at their workstation and clocked in at their scheduled start time.',
    qHappened: 'e.g. Employee arrived and clocked in at 9:47 AM with no prior notice given to the supervisor.',
    qWhen: 'e.g. May 23, 2025. Scheduled: 8:00 AM. Arrived: 9:47 AM.',
    qImpact: 'e.g. Coverage gap during peak hours. Supervisor had to redistribute tasks to other team members.',
  },
  'Inappropriate Conduct': {
    qExpected: 'e.g. Company policy requires respectful, professional communication with supervisors, colleagues, and clients at all times via all channels.',
    qHappened: 'e.g. On May 22, employee responded to a supervisor\'s feedback in the Teams channel with: I do not need to be told how to do my job. 4 team members were present.',
    qWhen: 'e.g. May 22, 2025 at approximately 2:30 PM via Microsoft Teams, Intake Team channel.',
    qImpact: 'e.g. Created tension in the team channel. Supervisor had to address it privately to avoid further escalation.',
  },
  'Misuse of Systems / Tools': {
    qExpected: 'e.g. Company policy prohibits sharing client data via personal devices or unauthorized channels. All client communication must go through company-approved systems.',
    qHappened: 'e.g. Employee shared a client\'s contact information via personal WhatsApp with a third party not authorized to receive it.',
    qWhen: 'e.g. Discovered on May 21, 2025. Incident believed to have occurred on May 20.',
    qImpact: 'e.g. Potential breach of client confidentiality and company data protection policy.',
  },
};

export const SCENARIO_LABELS: Record<NonNullable<Exclude<ScenarioType, ''>>, [string, string, string, string]> = {
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

export const EVIDENCE_OPTIONS: EvidenceType[] = [
  'Call Report',
  'Monday.com',
  'Attendance Record',
  'Email / Chat',
  'Witnesses',
  'Other',
];

export const WARNING_LEVELS: WarnLevel[] = [
  'Verbal Warning',
  'First Written Warning',
  'Second Written Warning',
  'Final Written Warning',
];

export const SCENARIOS: Exclude<ScenarioType, ''>[] = [
  'Operational Instructions',
  'Calls / Lead Follow-up',
  'Attendance / Tardiness',
  'Inappropriate Conduct',
  'Misuse of Systems / Tools',
];
