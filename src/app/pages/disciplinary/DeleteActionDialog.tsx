import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useMutateAction } from '@uibakery/data';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DisciplinaryRow } from '@/app/lib/disciplinary';
import updateDisciplinaryActionDeletedAction from '@/actions/updateDisciplinaryActionDeleted';

interface Props {
  action: DisciplinaryRow | null;   // null = dialog closed
  onClose: () => void;
  onSaved: () => void;
}

export default function DeleteActionDialog({ action: da, onClose, onSaved }: Props) {
  const open = da !== null;

  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteAction] = useMutateAction(updateDisciplinaryActionDeletedAction);

  useEffect(() => { if (!da) return; setNote(''); setError(null); }, [da]);

  const valid = note.trim() !== '';

  async function handleSubmit() {
    if (!da || !valid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await deleteAction({ id: da.id, note: note.trim() });
      if (!Array.isArray(res) || res.length === 0) {
        setError('Not allowed \u2014 only Tim and Saul can delete.');
        return;
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Disciplinary Action</DialogTitle>
          {da && (
            <p className="text-[12px] text-slate-500 mt-0.5">
              {da.employee_name}
              <span className="text-slate-400"> · </span>
              <span className="font-mono">{da.ref}</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-[12px] text-slate-600">
            The action is hidden from the list and no longer counts as a prior warning.
            Tim or Saul can restore it from the Deleted filter. Your login is recorded as who deleted it.
          </p>
          <div>
            <Label htmlFor="deletionNote" className="text-xs">
              Reason <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="deletionNote"
              value={note}
              onChange={e => setNote(e.target.value)}
              disabled={saving}
              rows={3}
              className="mt-1 text-sm resize-none"
              placeholder="e.g. Filed twice by mistake; the correct one is DA-0012."
            />
            {!note.trim() && (
              <p className="text-[11px] text-slate-400 mt-1">A reason is required to delete.</p>
            )}
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
            disabled={saving || !valid}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting…</>
              : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
