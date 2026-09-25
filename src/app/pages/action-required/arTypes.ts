// Action Required: shared types and constants (split out of ActionRequired.tsx, AR-1).

export type EntryRow = {
  id: number; period_name: string; employee_name: string; work_date: string;
  entry_time: string | null; exit_time: string | null;
  scheduled_start: string; grace_until: string; scheduled_end: string;
  late_minutes: number; late_after_grace: number; early_leave_minutes: number;
  discount_total_minutes: number; payroll_ready: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string; auto_notes: string;
  initial_status: string; status_current: string;
  /** The employee's schedule work days, e.g. "Mon,Tue,Wed,Thu,Fri" (AR-4, for the Shift column). */
  work_days?: string | null;
};

export type CommittedRow = {
  id: number; period_name: string; employee_name: string; work_date: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string; auto_notes: string;
  initial_status: string; status_current: string;
  discount_total_minutes: number; updated_at: string;
};

export type EditState = {
  entry_time: string; exit_time: string;
  event_type_1: string; pay_impact_1: string;
  event_type_2: string; pay_impact_2: string;
  documentation: string; notes: string;
};

export type SortDir = 'asc' | 'desc' | null;
export type SortKey = keyof EntryRow | null;

// Fields that broadcast to all selected rows when changed
export const BROADCAST_FIELDS: (keyof EditState)[] = [
  'event_type_1', 'pay_impact_1', 'event_type_2', 'pay_impact_2', 'documentation',
];

export const STATUS_CHIP: Record<string, string> = {
  RED:    'bg-[#FFC7CE] text-red-800 border-red-300',
  YELLOW: 'bg-[#FFEB9C] text-yellow-800 border-yellow-300',
  GREEN:  'bg-[#C6EFCE] text-green-800 border-green-300',
};

/** A row's loaded values in edit shape. Module level so useRowEdits sees a stable function. */
export function toEditState(row: EntryRow): EditState {
  return {
    entry_time: row.entry_time || '',
    exit_time: row.exit_time || '',
    event_type_1: row.event_type_1 || '',
    pay_impact_1: row.pay_impact_1 || '',
    event_type_2: row.event_type_2 || '',
    pay_impact_2: row.pay_impact_2 || '',
    documentation: row.documentation || '',
    notes: row.notes || '',
  };
}
