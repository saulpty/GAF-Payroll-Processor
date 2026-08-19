import { useState, useEffect } from 'react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';
import upsertPtoApprovalAction from '@/actions/upsertPtoApproval';
import updatePtoApprovalAction from '@/actions/updatePtoApproval';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';

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
}

export type DialogMode =
  | { kind: 'record'; request: PendingRequest }
  | { kind: 'edit';   row: LedgerRow }
  | { kind: 'manual' };

interface Props {
  mode: DialogMode | null;
  onClose: () => void;
  onSaved: () => void;
}

interface EmpOption { id: number; display_name: string; active: boolean }

const LS_RECORDED_BY = 'pto_recorded_by';

export default function RecordApprovalDialog({ mode, onClose, onSaved }: Props) {
  const open = mode !== null;

  const [leaveOn,    setLeaveOn]    = useState('');
  const [returnOn,   setReturnOn]   = useState('');
  const [totalDays,  setTotalDays]  = useState('');
  const [comments,   setComments]   = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [empId,      setEmpId]      = useState<number | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const [upsert] = useMutateAction(upsertPtoApprovalAction);
  const [update] = useMutateAction(updatePtoApprovalAction);

  // Load employees for the manual combobox (only needed in manual mode)
  const [allEmps] = useLoadAction(
    loadAllEmployeesAction,
    [] as EmpOption[],
    {},
    { enabled: mode?.kind === 'manual' },
  );
  const empOptions = (allEmps as EmpOption[]) ?? [];
  // active employees first, then inactive, both alphabetical
  const sortedEmps = [...empOptions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.display_name.localeCompare(b.display_name);
  });

  // Pre-fill when dialog opens / mode changes
  useEffect(() => {
    if (!mode) return;
    const saved = localStorage.getItem(LS_RECORDED_BY) ?? '';
    setRecordedBy(saved);
    setError(null);

    if (mode.kind === 'record') {
      const r = mode.request;
      const lo = (r.leave_on  ?? '').slice(0, 10);
      const ro = (r.return_on ?? '').slice(0, 10);
      setLeaveOn(lo);
      setReturnOn(ro);
      const days = r.total_days
        ? String(Number(r.total_days))
        : lo && ro ? String(defaultTotalDays(lo, ro)) : '';
      setTotalDays(days);
      setComments('');
      setEmpId(r.employee_id);
    } else if (mode.kind === 'edit') {
      const row = mode.row;
      const lo = (row.leave_on  ?? '').slice(0, 10);
      const ro = (row.return_on ?? '').slice(0, 10);
      setLeaveOn(lo);
      setReturnOn(ro);
      const days = row.total_days ? String(Number(row.total_days)) : lo && ro ? String(defaultTotalDays(lo, ro)) : '';
      setTotalDays(days);
      setComments(row.gaf_comments ?? '');
      setRecordedBy(row.recorded_by ?? saved);
      setEmpId(row.employee_id);
    } else {
      setLeaveOn('');
      setReturnOn('');
      setTotalDays('');
      setComments('');
      setEmpId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Auto-recalc days when dates change
  useEffect(() => {
    if (leaveOn && returnOn && leaveOn <= returnOn) {
      setTotalDays(String(defaultTotalDays(leaveOn, returnOn)));
    }
  }, [leaveOn, returnOn]);

  async function handleSave() {
    if (!mode) return;
    if (!leaveOn || !returnOn) { setError('Leave date and return date are required.'); return; }
    if (returnOn < leaveOn)    { setError('Return date must be on or after the leave date.'); return; }
    if (!recordedBy.trim())    { setError('Recorded by is required.'); return; }
    const days = parseFloat(totalDays);
    if (isNaN(days) || days <= 0) { setError('Total days must be a positive number.'); return; }
    if (mode.kind === 'manual' && !empId) { setError('Please select an employee.'); return; }

    setSaving(true);
    setError(null);
    try {
      localStorage.setItem(LS_RECORDED_BY, recordedBy.trim());

      if (mode.kind === 'edit') {
        await update({
          id:           mode.row.id,
          employee_id:  mode.row.employee_id,
          leave_on:     leaveOn,
          return_on:    returnOn,
          total_days:   days,
          gaf_comments: comments.trim() || null,
          recorded_by:  recordedBy.trim(),
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
          recorded_by:    recordedBy.trim(),
          monday_item_id: r.monday_item_id ?? null,
        });
      } else {
        // manual
        await upsert({
          employee_id:    empId,
          leave_on:       leaveOn,
          return_on:      returnOn,
          total_days:     days,
          status:         'recorded',
          source:         'manual',
          gaf_comments:   comments.trim() || null,
          submitted_by:   null,
          recorded_by:    recordedBy.trim(),
          monday_item_id: null,
        });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save approval.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode?.kind === 'edit' ? 'Edit PTO Approval'
              : mode?.kind === 'manual' ? 'Add PTO Manually'
              : 'Record PTO Approval';

  const employeeLabel = mode?.kind === 'record'
    ? (mode.request.display_name ?? mode.request.employee_name_raw ?? '—')
    : mode?.kind === 'edit'
    ? (mode.row.display_name ?? '—')
    : null;

  const unmatched = mode?.kind === 'record' && !mode.request.employee_id;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Employee */}
          <div>
            <Label className="text-xs text-slate-500">Employee</Label>
            {mode?.kind === 'manual' ? (
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
            ) : (
              <>
                <p className="text-sm font-medium mt-0.5">{employeeLabel}</p>
                {unmatched && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    ⚠ No employee match — approval will be saved without an employee link.
                  </p>
                )}
              </>
            )}
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
          </div>

          {/* Comments */}
          <div>
            <Label htmlFor="comments" className="text-xs">GAF comments (optional)</Label>
            <Textarea id="comments" value={comments} onChange={e => setComments(e.target.value)}
              rows={2} className="mt-1 text-sm resize-none" />
          </div>

          {/* Recorded by */}
          <div>
            <Label htmlFor="recordedBy" className="text-xs">Recorded by</Label>
            <Input id="recordedBy" value={recordedBy}
              onChange={e => setRecordedBy(e.target.value)}
              placeholder="Your name" className="mt-1 h-8 text-sm" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : mode?.kind === 'edit' ? 'Save changes' : mode?.kind === 'manual' ? 'Add approval' : 'Record approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
