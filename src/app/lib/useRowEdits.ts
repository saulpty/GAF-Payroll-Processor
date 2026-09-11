import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Unsaved per-row edits for an editable grid — one implementation for the
 * whole app (Payroll Master, Action Required) so Discard behaves the same
 * everywhere.
 *   getEdit(row)            the draft for a row, or its loaded values when untouched
 *   update(id, row, fn)     change the draft; fn receives the current draft
 *   isDirty(row)            the draft differs from the loaded row (value comparison)
 *   discard(id)             throw one row's draft away
 *   discardAll()            throw every draft away
 *   markSaved(id)           same as discard — after a save the loaded row is the truth
 *   dirtyCount              how many loaded rows have a differing draft
 * While dirtyCount > 0 the browser asks before unloading the page.
 * `toDraft` must be a stable function (module level), not an inline arrow.
 */
export function useRowEdits<Row extends { id: number }, Draft extends Record<string, string>>(
  toDraft: (row: Row) => Draft,
  rows: Row[],
) {
  const [edits, setEdits] = useState<Record<number, Draft>>({});

  const getEdit = useCallback((row: Row): Draft => edits[row.id] ?? toDraft(row), [edits, toDraft]);

  const isDirty = useCallback((row: Row): boolean => {
    const e = edits[row.id];
    if (!e) return false;
    const base = toDraft(row);
    return Object.keys(base).some(k => e[k] !== base[k]);
  }, [edits, toDraft]);

  const update = useCallback((id: number, row: Row, fn: (cur: Draft) => Draft) => {
    setEdits(prev => ({ ...prev, [id]: fn(prev[id] ?? toDraft(row)) }));
  }, [toDraft]);

  const discard = useCallback((id: number) => {
    setEdits(prev => {
      if (!(id in prev)) return prev;
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }, []);

  const discardAll = useCallback(() => setEdits({}), []);

  const dirtyCount = useMemo(() => rows.reduce((n, r) => n + (isDirty(r) ? 1 : 0), 0), [rows, isDirty]);

  useEffect(() => {
    if (dirtyCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount]);

  return { edits, getEdit, update, isDirty, discard, discardAll, markSaved: discard, dirtyCount };
}
