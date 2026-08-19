import { useState, useEffect } from 'react';
import { useMutateAction } from '@uibakery/data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';
import upsertPtoApprovalAction from '@/actions/upsertPtoApproval';

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

interface Props {
  request: PendingRequest | null;
  onClose: () => void;
  onSaved: () => void;
}

const LS_RECORDED_BY = 'pto_recorded_by';

export default function RecordApprovalDialog({ request, onClose, onSaved }: Props) {
  const open = request !== null;

  const [leaveOn,    setLeaveOn]    = useState('');
  const [returnOn,   setReturnOn]   = useState('');
  const [totalDays,  setTotalDays]  = useState('');
  const [comments,   setComments]   = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const [upsert] = useMutateAction(upsertPtoApprovalAction);

  // Pre-fill when dialog opens
  useEffect(() => {
    if (!request) return;
    const lo = (request.leave_on  ?? '').slice(0, 10);
    const ro = (request.return_on ?? '').slice(0, 10);
    setLeaveOn(lo);
    setReturnOn(ro);
    const days = request.total_days
      ? String(Number(request.total_days))
      : lo && ro ? String(defaultTotalDays(lo, ro)) : '';
    setTotalDays(days);
    setComments('');
    setError(null);
    const saved = localStorage.getItem(LS_RECORDED_BY) ?? '';
    setRecordedBy(saved);
  }, [request]);

  // Auto-recalc days when dates change
  useEffect(() => {
    if (leaveOn && returnOn) {
      setTotalDays(String(defaultTotalDays(leaveOn, returnOn)));
    }
  }, [leaveOn, returnOn]);

  async function handleSave() {
    if (!request) return;
    if (!leaveOn || !returnOn) { setError('Leave date and return date are required.'); return; }
    if (!recordedBy.trim())    { setError('Recorded by is required.');                 return; }
    const days = parseFloat(totalDays);
    if (isNaN(days) || days <= 0) { setError('Total days must be a positive number.'); return; }

    setSaving(true);
    setError(null);
    try {
      localStorage.setItem(LS_RECORDED_BY, recordedBy.trim());
      await upsert({
        employee_id:    request.employee_id,
        leave_on:       leaveOn,
        return_on:      returnOn,
        total_days:     days,
        status:         'recorded',
        source:         request.monday_item_id ? 'monday' : 'manual',
        gaf_comments:   comments.trim() || null,
        submitted_by:   request.employee_name_raw || null,
        recorded_by:    recordedBy.trim(),
        monday_item_id: request.monday_item_id ?? null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save approval.');
    } finally {
      setSaving(false);
    }
  }

  const name = request?.display_name ?? request?.employee_name_raw ?? '—';
  const unmatched = request !== null && !request.employee_id;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record PTO Approval</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Employee */}
          <div>
            <Label className="text-xs text-slate-500">Employee</Label>
            <p className="text-sm font-medium mt-0.5">{name}</p>
            {unmatched && (
              <p className="text-xs text-amber-600 mt-0.5">
                ⚠ No employee match — approval will be saved without an employee link.
              </p>
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
            {saving ? 'Saving…' : 'Record approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
