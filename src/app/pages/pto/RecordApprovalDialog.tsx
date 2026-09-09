import { useState, useEffect, useRef } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';
import { weekdayCount } from '@/app/lib/fmtDay';
import upsertPtoApprovalAction from '@/actions/upsertPtoApproval';
import updatePtoApprovalAction from '@/actions/updatePtoApproval';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import RecordDialogPayrollPanel from './RecordDialogPayrollPanel';

export interface PendingRequest {
  monday_item_id: number | null;
  employee_id: number | null;
  display_name: string | null;
  employee_name_raw: string;
  leave_on: string | null;
  return_on: string | null;
  total_days: string | null;
  reason: string | null;
  submitted_at: string | null;
  leave_type?: 'pto' | 'floating_holiday';
}

export interface LedgerRow {
  id: number;
  employee_id: number | null;
  display_name: string | null;
  leave_on: string | null;
  return_on: string | null;
  total_days: string | null;
  status: string;
  source: string;
  gaf_comments: string | null;
  recorded_by: string | null;
  monday_item_id: number | null;
  leave_type: 'pto' | 'floating_holiday';
}

export type DialogMode =
  | { kind: 'record'; request: PendingRequest; match?: PayrollMatch }
  | { kind: 'edit';   row: LedgerRow;          match?: PayrollMatch }
  | { kind: 'manual' };

interface Props {
  mode: DialogMode | null;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}

interface EmpOption { id: number; display_name: string; active: boolean }

/** Postgres sometimes returns full timestamps; we only want the date part. */
function ymd(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : '';
}

export default function RecordApprovalDialog({ mode, today, onClose, onSaved }: Props) {
  const open = mode !== null;
  const thisYear = today.slice(0, 4);

  const [leaveOn,    setLeaveOn]    = useState('');
  const [returnOn,   setReturnOn]   = useState('');
  const [totalDays,  setTotalDays]  = useState('');
  const [comments,   setComments]   = useState('');
  const [empId,      setEmpId]      = useState<number | null>(null);
  const [leaveType,  setLeaveType]  = useState<'pto' | 'floating_holiday'>('pto');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Guard: skip one auto-recalc run when onApply sets dates+days directly
  const skipRecalcRef = useRef(false);

  const [upsert] = useMutateAction(upsertPtoApprovalAction);
  const [update] = useMutateAction(updatePtoApprovalAction);

  const [allEmps] = useLoadAction(
    loadAllEmployeesAction,
    [] as EmpOption[],
    {},
    { enabled: mode?.kind === 'manual' },
  );
  const empOptions = (allEmps as EmpOption[]) ?? [];
  const sortedEmps = [...empOptions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  // Pre-fill when dialog opens / mode changes
  useEffect(() => {
    if (!mode) return;
    setError(null);
    skipRecalcRef.current = false;

    if (mode.kind === 'record') {
      const r = mode.request;
      const lo = ymd(r.leave_on);
      const ro = ymd(r.return_on);
      setLeaveOn(lo);
      setReturnOn(ro);
      const lt = r.leave_type ?? 'pto';
      setLeaveType(lt);
      const days = r.total_days
        ? String(Number(r.total_days))
        : lo && ro ? String(lt === 'floating_holiday' ? weekdayCount(lo, ro) : defaultTotalDays(lo, ro)) : '';
      setTotalDays(days);
      setComments('');
      setEmpId(r.employee_id);
    } else if (mode.kind === 'edit') {
      const row = mode.row;
      const lo = ymd(row.leave_on);
      const ro = ymd(row.return_on);
      setLeaveOn(lo);
      setReturnOn(ro);
      const lt = row.leave_type ?? 'pto';
      setLeaveType(lt);
      const days = row.total_days ? String(Number(row.total_days)) : lo && ro ? String(lt === 'floating_holiday' ? weekdayCount(lo, ro) : defaultTotalDays(lo, ro)) : '';
      setTotalDays(days);
      setComments(row.gaf_comments ?? '');
      setEmpId(row.employee_id);
    } else {
      setLeaveOn('');
      setReturnOn('');
      setTotalDays('');
      setComments('');
      setEmpId(null);
      setLeaveType('pto');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Auto-recalc days when dates or leaveType change
  useEffect(() => {
    if (skipRecalcRef.current) {
      skipRecalcRef.current = false;
      return;
    }
    if (leaveOn && returnOn && leaveOn <= returnOn) {
      setTotalDays(String(leaveType === 'floating_holiday'
        ? weekdayCount(leaveOn, returnOn)
        : defaultTotalDays(leaveOn, returnOn)));
    }
  }, [leaveOn, returnOn, leaveType]);

  function handleApplyPayroll(lo: string, ro: string, days: number) {
    skipRecalcRef.current = true;
    setLeaveOn(lo);
    setReturnOn(ro);
    setTotalDays(String(days));
  }

  async function handleSave() {
    if (!mode) return;
    if (!leaveOn || !returnOn) { setError('Leave date and return date are required.'); return; }
    if (returnOn < leaveOn)    { setError('Return date must be on or after the leave date.'); return; }
    if (returnOn > today) {
      setError('The return date has not passed yet — record this after the employee is back.');
      return;
    }
    const days = parseFloat(totalDays);
    if (isNaN(days) || days <= 0) { setError('Total days must be a positive number.'); return; }
    if (mode.kind === 'manual' && !empId) { setError('Please select an employee.'); return; }

    setSaving(true);
    setError(null);
    try {
      if (mode.kind === 'edit') {
        await update({
          id:           mode.row.id,
          employee_id:  mode.row.employee_id,
          leave_on:     leaveOn,
          return_on:    returnOn,
          total_days:   days,
          gaf_comments: comments.trim() || null,
          recorded_by:  mode.row.recorded_by,
          leave_type:   leaveType,
        });
      } else if (mode.kind === 'record') {
        const r = mode.request;
        await upsert({
          employee_id:    r.employee_id,
          leave_on:       leaveOn,
          return_on:      returnOn,
          total_days:     days,
          status:         'recorded',
          source:         'monday',
          gaf_comments:   comments.trim() || null,
          submitted_by:   r.employee_name_raw || null,
          recorded_by:    'app',
          monday_item_id: r.monday_item_id ?? null,
          leave_type:     leaveType,
        });
      } else {
        await upsert({
          employee_id:    empId,
          leave_on:       leaveOn,
          return_on:      returnOn,
          total_days:     days,
          status:         'recorded',
          source:         'manual',
          gaf_comments:   comments.trim() || null,
          submitted_by:   null,
          recorded_by:    'app',
          monday_item_id: null,
          leave_type:     leaveType,
        });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save approval.');
    } finally {
      setSaving(false);
    }
  }

  const isFloating = leaveType === 'floating_holiday';
  const title = mode?.kind === 'edit'
    ? (isFloating ? 'Edit floating holiday' : 'Edit PTO')
    : mode?.kind === 'manual'
      ? (isFloating ? 'Add floating holiday manually' : 'Add PTO manually')
      : (isFloating ? 'Record floating holiday' : 'Record PTO');

  const employeeName =
    mode?.kind === 'record' ? (mode.request.display_name ?? mode.request.employee_name_raw ?? '—')
    : mode?.kind === 'edit' ? (mode.row.display_name ?? '—')
    : null;

  const subtitle = employeeName
    ? `${employeeName}${mode?.kind === 'record' ? ' · from Monday request' : ''}`
    : null;

  const unmatched = mode?.kind === 'record' && !mode.request.employee_id;

  const daysNum = Number(totalDays);
  const primaryLabel = mode?.kind === 'record' && daysNum > 0
    ? `Record ${daysNum} day(s)`
    : mode?.kind === 'edit' ? 'Save changes'
    : mode?.kind === 'manual' ? 'Add approval'
    : 'Record approval';

  // Payroll mismatch note
  const match = mode?.kind !== 'manual' ? (mode?.match ?? null) : null;
  const actualDays = match?.state === 'matched' && match.actualDays !== null ? match.actualDays : null;
  const payrollMismatchNote = actualDays !== null && String(actualDays) !== totalDays
    ? `Payroll shows ${actualDays} day(s); recording ${totalDays}.`
    : null;

  // Panel data for record/edit
  const panelRequested = mode?.kind === 'record' ? {
    leaveOn: ymd(mode.request.leave_on),
    returnOn: ymd(mode.request.return_on),
    days: Number(mode.request.total_days) || 0,
    reason: mode.request.reason,
    submittedAt: mode.request.submitted_at,
    source: 'Monday' as const,
  } : mode?.kind === 'edit' ? {
    leaveOn: ymd(mode.row.leave_on),
    returnOn: ymd(mode.row.return_on),
    days: Number(mode.row.total_days) || 0,
    reason: null,
    submittedAt: null,
    source: 'ledger' as const,
  } : null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && (
            <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Payroll panel — record and edit modes */}
          {panelRequested && (
            <RecordDialogPayrollPanel
              requested={panelRequested}
              match={match}
              leaveType={leaveType}
              thisYear={thisYear}
              onApply={handleApplyPayroll}
            />
          )}

          {/* Type — manual mode only */}
          {mode?.kind === 'manual' && (
            <div>
              <Label className="text-xs text-slate-500">Type</Label>
              <select
                value={leaveType}
                onChange={e => setLeaveType(e.target.value as 'pto' | 'floating_holiday')}
                className="mt-1 block w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="pto">PTO</option>
                <option value="floating_holiday">Floating holiday</option>
              </select>
            </div>
          )}

          {/* Employee — manual mode picker, others show name */}
          {mode?.kind === 'manual' ? (
            <div>
              <Label className="text-xs text-slate-500">Employee</Label>
              <select
                value={empId ?? ''}
                onChange={e => setEmpId(e.target.value ? Number(e.target.value) : null)}
                className="mt-1 block w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">Select employee…</option>
                {sortedEmps.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.display_name}{e.active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            unmatched && (
              <p className="text-xs text-amber-600">
                ⚠ No employee match — approval will be saved without an employee link.
              </p>
            )
          )}

          {/* Section label */}
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 -mb-2">
            Recording
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="leaveOn" className="text-xs">Leave on</Label>
              <Input id="leaveOn" type="date" value={leaveOn}
                onChange={e => setLeaveOn(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label htmlFor="returnOn" className="text-xs">Return on</Label>
              <Input id="returnOn" type="date" value={returnOn}
                onChange={e => setReturnOn(e.target.value)} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          {/* Total days */}
          <div className="w-32">
            <Label htmlFor="totalDays" className="text-xs">Total days</Label>
            <Input id="totalDays" type="number" step="0.5" min="0.5" value={totalDays}
              onChange={e => setTotalDays(e.target.value)} className="mt-1 h-8 text-sm" />
            {payrollMismatchNote && (
              <p className="text-[12px] text-amber-600 mt-0.5">{payrollMismatchNote}</p>
            )}
          </div>

          {/* Comments */}
          <div>
            <Label htmlFor="comments" className="text-xs">GAF comments (optional)</Label>
            <Textarea id="comments" value={comments} onChange={e => setComments(e.target.value)}
              rows={2} className="mt-1 text-sm resize-none" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
              : primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
