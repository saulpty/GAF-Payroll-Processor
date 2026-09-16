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
import { useViewer } from '@/app/context/ViewerContext';
import updateDisciplinaryActionDeletedAction from '@/actions/updateDisciplinaryActionDeleted';

interface Props {
  action: DisciplinaryRow | null;   // null = dialog closed
  onClose: () => void;
  onSaved: () => void;
}

export default function DeleteActionDialog({ action: da, onClose, onSaved }: Props) {
  const open = da !== null;
  const { name } = useViewer();

  const [deletedBy, setDeletedBy] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteAction] = useMutateAction(updateDisciplinaryActionDeletedAction);

  useEffect(() => {
    if (!da) return;
    setDeletedBy(name ?? '');
    setNote('');
    setError(null);
  }, [da, name]);

  const valid = deletedBy.trim() !== '' && note.trim() !== '';

  async function handleSubmit() {
    if (!da || !valid) return;
    setSaving(true);
    setError(null);
    try {
      await deleteAction({ id: da.id, deletedBy: deletedBy.trim(), note: note.trim() });
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
            A super user can restore it from the Deleted filter.
          </p>
          <div>
            <Label htmlFor="deletedBy" className="text-xs">Deleted By</Label>
            <Input
              id="deletedBy"
              value={deletedBy}
              onChange={e => setDeletedBy(e.target.value)}
              disabled={saving}
              className="mt-1 h-8 text-sm"
              placeholder="Your name"
            />
          </div>
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
