import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import updateDisciplinaryActionClosedAction from '@/actions/updateDisciplinaryActionClosed';

interface Props {
  action: DisciplinaryRow | null;   // null = closed dialog
  onClose: () => void;
  onSaved: () => void;
}

export default function CloseCaseDialog({ action: da, onClose, onSaved }: Props) {
  const open = da !== null;

  const [closedBy, setClosedBy] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [closeCase] = useMutateAction(updateDisciplinaryActionClosedAction);

  // Pre-fill manager name when dialog opens
  useEffect(() => {
    if (!da) return;
    setClosedBy(da.manager_name ?? '');
    setNote('');
    setError(null);
  }, [da]);

  async function handleSubmit() {
    if (!da) return;
    if (!closedBy.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await closeCase({ id: da.id, closedBy: closedBy.trim(), note: note.trim() || null });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to close case. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close case</DialogTitle>
          {da && (
            <p className="text-[12px] text-slate-500 mt-0.5">
              {da.employee_name}
              <span className="text-slate-400"> · </span>
              <span className="font-mono">{da.ref}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <Label htmlFor="closedBy" className="text-xs">Closed by</Label>
            <Input
              id="closedBy"
              value={closedBy}
              onChange={e => setClosedBy(e.target.value)}
              disabled={saving}
              className="mt-1 h-8 text-sm"
              placeholder="Your name"
            />
          </div>

          <div>
            <Label htmlFor="closureNote" className="text-xs">
              Note <span className="text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="closureNote"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={saving}
              rows={3}
              className="mt-1 text-sm resize-none"
              placeholder="e.g. Employee improved; follow-up sent by email 07-10-2026."
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !closedBy.trim()}
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Closing…</>
              : 'Close case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
