import { useEffect, useRef, useState } from 'react';
import { isValidTimeInput } from '@/app/lib/parseTimeInput';
import { refusalReason } from './arLogic';
import type { CommittedRow, EditState, EntryRow } from './arTypes';

type SaveResult = { status: string; saved: CommittedRow } | null;
type Fn = () => unknown;
const plural = (n: number) => `${n} ${n === 1 ? 'row' : 'rows'}`;

/**
 * Commit, Undo and Revert for Action Required (AR-3; moved out of the page).
 * Rows committed to GREEN leave the table at once; drafts are dropped only after
 * the reload lands; counts refresh through bumpArVersion; results go to the toast.
 * Each row is saved on its own: one failure is reported and never stops the rest.
 */
export function useArCommit({ rows, getEdit, saveRow, revertRow, reload, reloadCommitted, markSaved, bumpArVersion, toast }: {
  rows: unknown;
  getEdit: (row: EntryRow) => EditState;
  saveRow: (row: EntryRow) => Promise<SaveResult>;
  revertRow: (r: CommittedRow) => Promise<void>;
  reload: Fn;
  reloadCommitted: Fn;
  markSaved: (id: number) => void;
  bumpArVersion: () => void;
  toast: { show: (o: { message: string; tone?: 'success' | 'error'; onUndo?: () => void }) => void };
}) {
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sessionCommitted, setSessionCommitted] = useState<Set<number>>(new Set());
  const [revertingIds, setRevertingIds] = useState<Set<number>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  // Fresh rows arrived: nothing needs hiding any more. Keeps the same Set when already empty.
  useEffect(() => { setHiddenIds(prev => (prev.size ? new Set() : prev)); }, [rows]);

  // Undo can fire seconds later, after a period change: always call the current loaders.
  const live = useRef({ reload, reloadCommitted, bumpArVersion });
  live.current = { reload, reloadCommitted, bumpArVersion };
  const refresh = async () => {
    live.current.bumpArVersion();
    await live.current.reload();
    await live.current.reloadCommitted();
  };

  const reasonFor = (row: EntryRow) => refusalReason(getEdit(row), isValidTimeInput);

  const undoCommit = async (done: CommittedRow[]) => {
    const failed: string[] = [];
    let moved = 0;
    for (const r of done) {
      try { await revertRow(r); moved++; } catch { failed.push(`${r.employee_name} ${r.work_date.slice(0, 10)}`); }
    }
    setSessionCommitted(prev => { const s = new Set(prev); done.forEach(r => s.delete(r.id)); return s; });
    await refresh();
    if (moved) toast.show({ message: `Moved ${plural(moved)} back to Action Required` });
    if (failed.length) toast.show({ tone: 'error', message: `Could not undo: ${failed.join(', ')}` });
  };

  const commitRows = async (toSave: EntryRow[]) => {
    if (!toSave.length) return;
    setBulkSaving(true);
    const refused: string[] = [];
    const failed: string[] = [];
    const savedIds: number[] = [];
    const green: CommittedRow[] = [];
    for (const row of toSave) {
      const label = `${row.employee_name} ${row.work_date.slice(0, 10)}`;
      const reason = reasonFor(row);
      if (reason) { refused.push(`${label} (${reason})`); continue; }
      try {
        const res = await saveRow(row);
        if (res === null) { refused.push(`${label} (Entry and Exit must look like 9:05 AM)`); continue; }
        savedIds.push(row.id);
        setSessionCommitted(prev => new Set(prev).add(row.id));
        if (res.status === 'GREEN') {
          green.push(res.saved);
          setHiddenIds(prev => new Set(prev).add(row.id));
        }
      } catch {
        failed.push(label);
      }
    }
    setBulkSaving(false);
    if (refused.length) toast.show({ tone: 'error', message: `Not committed: ${refused.join(', ')}` });
    if (failed.length) toast.show({ tone: 'error', message: `Save failed, please try again: ${failed.join(', ')}` });
    if (green.length) {
      toast.show({ message: `Committed ${plural(green.length)} to green`, onUndo: () => { void undoCommit(green); } });
    }
    const notGreen = savedIds.length - green.length;
    if (notGreen > 0) toast.show({ message: `Saved ${plural(notGreen)}; still not green` });
    try {
      await refresh();
    } finally {
      // Drop the drafts only once fresh rows are in, so no row flashes its old values.
      savedIds.forEach(id => markSaved(id));
    }
  };

  const handleRevert = async (r: CommittedRow) => {
    setRevertingIds(prev => new Set(prev).add(r.id));
    try {
      await revertRow(r);
      setSessionCommitted(prev => { const s = new Set(prev); s.delete(r.id); return s; });
      await refresh();
    } catch {
      toast.show({ tone: 'error', message: `Could not revert ${r.employee_name} ${r.work_date.slice(0, 10)}` });
    } finally {
      setRevertingIds(prev => { const s = new Set(prev); s.delete(r.id); return s; });
    }
  };

  return { commitRows, handleRevert, reasonFor, bulkSaving, sessionCommitted, setSessionCommitted, revertingIds, hiddenIds };
}
