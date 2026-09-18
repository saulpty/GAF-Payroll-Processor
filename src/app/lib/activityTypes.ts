// Activity days — shared types, split out of activityDays.ts to keep it under the 15 KB cap.
// Pure: no runtime imports, no Date maths. Contract 2026-09-18 (ghost records).

export type WhyKind = 'pto' | 'permission' | 'sick' | 'form' | 'holiday' | 'wfh' | 'day_off' | 'none';
export type WhyChip = { kind: WhyKind; label: string; tone: 'blue' | 'amber' | 'gray' };

export type ActivitySettings = {
  minActiveMinutes: number;   // 390 on a 480-min shift
  breakMinutes: number; breakOverMinutes: number;
};

export type ActivityDayRow = {
  employee_id: number; work_date: number;
  first_min: number; last_ymd: number; last_min: number;
  active_s: number; records: number; largest_gap_min: number; gap_start_min: number;
  has_manual: boolean; accounts: number; synced_at: string;
  ghost_min: number;
};

export type ActivityEmployee = {
  id: number; name: string; role: string; manager: string;
  work_days: string; schedule_start: string; schedule_end: string;
};

export type ActivityDay = {
  employeeId: number; employeeName: string; role: string; manager: string;
  date: string; scheduled: boolean; shiftMinutes: number;
  firstMin: number | null; lastMin: number | null; crossesMidnight: boolean;
  activeMin: number; breaksMin: number; largestGapMin: number; gapStartMin: number;
  records: number; accounts: number; hasManual: boolean;
  official: boolean; edited: boolean;
  officialEntryMin: number | null; officialExitMin: number | null;
  /** First / Last to display: official punch when captured, else Teramind. */
  shownFirstMin: number | null; shownLastMin: number | null;
  why: WhyChip | null;
  flag: 'low_activity' | 'long_break' | null;
  needsLook: boolean; isToday: boolean;
  /** Minutes since midnight of the earliest ghost record that day; null when there is none. */
  ghostMin: number | null;
};

export type EmployeeActivitySummary = {
  employeeId: number; employeeName: string; role: string; manager: string;
  scheduledDays: number; daysWorked: number;
  avgActiveMin: number | null; avgFirstMin: number | null; avgLastMin: number | null;
  needsLook: number; awayDays: number; awayLabel: string;
  days: ActivityDay[];   // newest first
};

export type ActivityTotals = {
  avgActiveMin: number | null; daysWorked: number; needsLook: number; lateArrivals: number;
};
