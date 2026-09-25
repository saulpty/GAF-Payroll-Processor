import { Clock, Laptop, Ban, CheckCircle2, type LucideIcon } from 'lucide-react';

// Roster: shared types and flag metadata (split out of RosterTab.tsx, 2026-09-25).
export type EmpRow = {
  id: number; display_name: string; teramind_email: string; company_domain: string;
  is_grace_list: boolean; is_macbook_swap: boolean; excluded_from_payroll: boolean;
  active: boolean; start_date: string; end_date: string; notes: string;
  schedule_name: string; schedule_id: number;
};
export type Schedule = { id: number; schedule_name: string };

export const EMPTY_EMP: Partial<EmpRow> = {
  display_name: '', teramind_email: '', company_domain: '',
  schedule_id: 0, is_grace_list: false, is_macbook_swap: false,
  excluded_from_payroll: false, active: true, notes: '',
};

export type FlagKey = 'is_grace_list' | 'is_macbook_swap' | 'excluded_from_payroll' | 'active';

export const FLAG_META: { key: FlagKey; label: string; icon: LucideIcon; tip: string; danger?: boolean }[] = [
  { key: 'is_grace_list',         label: 'Grace',    icon: Clock,        tip: 'Gets 10-min tardiness grace period before flagging' },
  { key: 'is_macbook_swap',       label: 'Macbook',  icon: Laptop,       tip: 'Missing Teramind data defaults to GREEN (not flagged absent)' },
  { key: 'excluded_from_payroll', label: 'Excluded', icon: Ban,          tip: 'Skipped entirely during payroll processing runs', danger: true },
  { key: 'active',                label: 'Active',   icon: CheckCircle2, tip: 'Inactive employees are excluded from payroll runs', danger: true },
];
