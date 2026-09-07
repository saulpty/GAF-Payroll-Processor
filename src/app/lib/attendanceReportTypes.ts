// Pure type declarations — no imports needed.
// Callers who need both types and runtime exports should import from attendanceReport.ts,
// which re-exports everything from here.

export type ReportEmployee = {
  id: number; name: string; email: string; role: string; manager: string;
  work_days: string;
  start_date: string | null;
  standard_start: string; standard_end: string;
  dst_start: string; dst_end: string;
  grace_minutes: number;
};

export type ReportPayrollRow = {
  employee_id: number; work_date: string;
  entry_time: string | null; exit_time: string | null;
  scheduled_start: string | null;
  late_minutes: number; early_leave_minutes: number;
  event_type_1: string; documentation: string; auto_notes: string;
  period_name: string;
};

export type ReportForm = {
  employee_id: number; form_date: string; form_type: string;
  reason: string; details: string; eta: string;
  submitted_at: string | null; employee_email_raw: string; monday_item_id: string;
};

export type ReportRequest = {
  employee_id: number; request_type: string; permission_type: string;
  start_date: string | null; end_date: string | null; return_date: string | null;
};

export type ReportPeriod = {
  period_name: string; start_date: string | null; end_date: string | null;
  processed_at: string | null;
};

export type ReportHoliday = { date: string; name: string };

export type Verdict =
  | 'on_time' | 'late_reported_on_time' | 'late_reported_late' | 'late_no_form'
  | 'absent_reported_on_time' | 'absent_reported_late' | 'unexplained_absence'
  | 'pto' | 'permission' | 'holiday' | 'not_processed';

export type ReportFormView = {
  type: string; reason: string; details: string; eta: string;
  submittedAt: string | null;
  submittedMinutes: number | null;
  onTime: boolean;
  mondayItemId: string;
};

export type ReportRow = {
  employeeId: number; employeeName: string; email: string;
  role: string; manager: string;
  date: string;
  scheduledStart: string;
  entryTime: string | null; exitTime: string | null;
  minutesLate: number; earlyLeaveMinutes: number;
  form: ReportFormView | null;
  allForms: ReportFormView[];
  coveredBy: { kind: 'pto' | 'permission' | 'holiday'; label: string } | null;
  verdict: Verdict;
  countsToScore: boolean;
  flags: {
    multipleForms: boolean;
    recordedUnexplainedButFormOnFile: boolean;
    formEmailUnrecognised: boolean;
  };
};

export type ReportSummary = {
  employeeId: number; employeeName: string; role: string; manager: string;
  expectedDays: number;
  onTime: number;
  lateDays: number;
  lateDaysWithoutForm: number;
  unexplainedAbsences: number;
  awayDays: number;
  formsFiled: number;
  formsOnTime: number;
  onTimeRate: number | null;
};

export type ReportHelpers = {
  isScheduledWorkDay: (date: Date, workDays: string | undefined) => boolean;
  getSchedule: (
    emp: { dst_start: string; dst_end: string; standard_start: string; standard_end: string; grace_minutes: number },
    date: Date,
    dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[],
  ) => { start: string; end: string; grace: string };
  parseTimeToMinutes: (t: string) => number;
};

export type ReportInput = {
  dateFrom: string; dateTo: string;
  employees: ReportEmployee[];
  payrollRows: ReportPayrollRow[];
  forms: ReportForm[];
  requests: ReportRequest[];
  holidays: ReportHoliday[];
  periods: ReportPeriod[];
  dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[];
  helpers: ReportHelpers;
};

export type ReportOutput = {
  rows: ReportRow[];
  perEmployee: ReportSummary[];
  unmatchedForms: number;
};
