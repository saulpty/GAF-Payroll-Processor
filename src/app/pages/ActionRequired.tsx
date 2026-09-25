import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import loadActionRequiredAction from '@/actions/loadActionRequired';
import loadCommittedEntriesAction from '@/actions/loadCommittedEntries';
import loadEventTypeRulesAction from '@/actions/loadEventTypeRules';
import loadPayImpactsAction from '@/actions/loadPayImpacts';
import loadDocumentationOptionsAction from '@/actions/loadDocumentationOptions';
import loadEventTypesAction from '@/actions/loadEventTypes';
import { useRowEdits } from '@/app/lib/useRowEdits';
import { ToastProvider, useToast } from '@/app/components/ds/Toast';
import { BROADCAST_FIELDS, toEditState, type CommittedRow, type EditState, type EntryRow, type SortDir, type SortKey } from './action-required/arTypes';
import { filterRows, nextSort, rangeIds, showBulkBar } from './action-required/arLogic';
import { ArHead } from './action-required/ArHead';
import { ArCommitBar } from './action-required/ArCommitBar';
import { ArRow } from './action-required/ArRow';
import { ArCommitted } from './action-required/ArCommitted';
import { ArConfirm } from './action-required/ArConfirm';
import { useArSave } from './action-required/useArSave';
import { useArCommit } from './action-required/useArCommit';

// The page owns its toasts (page-by-page rollout: app.tsx is untouched).
export default function ActionRequired() {
  return <ToastProvider><ActionRequiredPage /></ToastProvider>;
}

function ActionRequiredPage() {
  const { period: selectedPeriod, employee: globalEmployee, statusTab: activeTab, bumpArVersion } = useGlobalFilters();
  const toast = useToast();
  const [payImpacts] = useLoadAction(loadPayImpactsAction, [] as { name: string }[]);
  const [docOptions] = useLoadAction(loadDocumentationOptionsAction, [] as { name: string }[]);
  const [eventTypes] = useLoadAction(loadEventTypesAction, [] as { id: number; name: string }[]);
  const [eventRulesRaw] = useLoadAction(loadEventTypeRulesAction, [] as { event_type: string; default_pay_impact: string; default_doc_option: string }[]);

  const [params, setParams] = useState({ periodName: selectedPeriod });
  const [rows, loading, , reload] = useLoadAction(loadActionRequiredAction, [] as EntryRow[], params);
  const { getEdit, update, isDirty, discardAll, markSaved, dirtyCount } = useRowEdits<EntryRow, EditState>(toEditState, rows as EntryRow[]);
  const [committedRows, , , reloadCommitted] = useLoadAction(loadCommittedEntriesAction, [] as CommittedRow[], params);
  const { saveRow, revertRow } = useArSave(getEdit);
  const { commitRows, handleRevert, reasonFor, bulkSaving, sessionCommitted, setSessionCommitted, revertingIds, hiddenIds } =
    useArCommit({ rows, getEdit, saveRow, revertRow, reload, reloadCommitted, markSaved, bumpArVersion, toast });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [committedOpen, setCommittedOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  // Rows waiting in the confirm dialog: the bulk selection, or one row's own Commit button.
  const [confirmIds, setConfirmIds] = useState<number[] | null>(null);

  const impactOptions = (payImpacts as { name: string }[]).map(p => p.name);
  const docOpts = (docOptions as { name: string }[]).map(d => d.name);
  const eventOpts = (eventTypes as { name: string }[]).map(e => e.name);

  const rulesMap = useMemo(() => {
    const m = new Map<string, { pay_impact: string; doc_option: string }>();
    for (const r of eventRulesRaw) {
      m.set(r.event_type, { pay_impact: r.default_pay_impact || '', doc_option: r.default_doc_option || '' });
    }
    return m;
  }, [eventRulesRaw]);

  // Sync params when global period changes
  useEffect(() => {
    setParams({ periodName: selectedPeriod });
    discardAll();
    setSelected(new Set());
    setSessionCommitted(new Set());
    setSortKey(null);
    setSortDir(null);
  }, [selectedPeriod]);

  // Editing a row no longer selects it (AR-3): selection is the checkbox only, so an
  // edit never silently broadcasts to rows touched earlier. Broadcast applies only to a
  // deliberate 2+ selection, only to rows currently visible, and each target's draft is
  // built from that row's own data (never from the edited row's times or notes).
  const setEditField = useCallback((id: number, field: keyof EditState, value: string, row: EntryRow, visibleRows?: EntryRow[]) => {
    const isBroadcast = BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1;
    const visibleIds = new Set((visibleRows ?? []).map(r => r.id));
    const targetIds = isBroadcast ? Array.from(selected).filter(t => t === id || visibleIds.has(t)) : [id];
    const rowMap = new Map((rows as EntryRow[]).map(r => [r.id, r]));

    for (const tid of targetIds) {
      const trow = tid === id ? row : rowMap.get(tid);
      if (!trow) continue;
      update(tid, trow, current => {
        const updated = { ...current, [field]: value };
        if (field === 'event_type_1' && value && rulesMap.has(value)) {
          const rule = rulesMap.get(value)!;
          if (!current.pay_impact_1 && rule.pay_impact) updated.pay_impact_1 = rule.pay_impact;
          if (!current.documentation && rule.doc_option) updated.documentation = rule.doc_option;
        }
        if (field === 'event_type_2' && value && rulesMap.has(value)) {
          const rule = rulesMap.get(value)!;
          if (!current.pay_impact_2 && rule.pay_impact) updated.pay_impact_2 = rule.pay_impact;
        }
        return updated;
      });
    }
  }, [update, rulesMap, selected, rows]);

  const allRows = useMemo(() => (rows as EntryRow[]).filter(r => !hiddenIds.has(r.id)), [rows, hiddenIds]);
  // Only the very first load replaces the page with a spinner; later reloads are silent.
  const firstLoad = loading && (rows as EntryRow[]).length === 0;
  const filtered = useMemo(
    () => filterRows(allRows, activeTab, globalEmployee, sortKey, sortDir),
    [allRows, activeTab, globalEmployee, sortKey, sortDir],
  );

  const handleConfirm = async () => {
    const ids = new Set(confirmIds ?? []);
    setConfirmIds(null);
    const toSave = filtered.filter(r => ids.has(r.id));
    setSelected(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    setLastSelectedIndex(null);
    await commitRows(toSave);
  };

  const handleSort = (key: SortKey) => {
    const [k, d] = nextSort(sortKey, sortDir, key);
    setSortKey(k);
    setSortDir(d);
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const someSelected = filtered.some(r => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(r => s.delete(r.id)); return s; });
      setLastSelectedIndex(null);
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(r => s.add(r.id)); return s; });
      setLastSelectedIndex(filtered.length - 1);
    }
  };

  const toggleRow = (id: number, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex !== null) {
      const ids = rangeIds(filtered, index, lastSelectedIndex);
      // If the anchor was selected, select the range; otherwise deselect
      const anchorSelected = selected.has(filtered[lastSelectedIndex]?.id);
      setSelected(prev => {
        const s = new Set(prev);
        ids.forEach(rid => anchorSelected ? s.add(rid) : s.delete(rid));
        return s;
      });
    } else {
      setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
      setLastSelectedIndex(index);
    }
  };

  const committed = committedRows as CommittedRow[];
  const selectedCount = filtered.filter(r => selected.has(r.id)).length;
  const bulk = showBulkBar(selectedCount);

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">

      {/* ── Empty states ────────────────────────────────────────── */}
      {firstLoad && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading entries…</div>
      )}
      {!firstLoad && allRows.length === 0 && (
        <Card className="border-green-300 bg-green-50 flex-1">
          <CardContent className="pt-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-green-800 font-semibold text-base">{selectedPeriod ? `All clear for ${selectedPeriod}!` : 'All clear — all periods!'}</p>
            <p className="text-green-700 text-sm mt-1">No unresolved entries.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      {!firstLoad && allRows.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">

          <ArCommitBar someSelected={bulk} selectedCount={selectedCount} selectedSize={selected.size}
            bulkSaving={bulkSaving} dirtyCount={dirtyCount}
            onDeselectAll={() => setSelected(new Set())}
            onCommit={() => setConfirmIds(filtered.filter(r => selected.has(r.id)).map(r => r.id))}
            onDiscardAll={discardAll} />

          {/* ── Work table ─────────────────────────────────────── */}
          {/* While data refreshes the table stays put but dims and ignores clicks, so the
              previous period's rows can never be edited or committed by mistake. */}
          <div className={`flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto transition-opacity ${loading ? 'opacity-60 pointer-events-none' : ''}`}
            aria-busy={loading || undefined}>
            <table className="w-full text-xs border-collapse tabular-nums" style={{ minWidth: 1120 }}>
              <ArHead allFilteredSelected={allFilteredSelected} someSelected={someSelected} showPeriod={!selectedPeriod}
                sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onToggleAll={toggleSelectAll} />
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="px-4 py-8 text-center text-muted-foreground text-sm">No results match your filter.</td></tr>
                )}
                {filtered.map((row, rowIndex) => {
                  const isSelected = selected.has(row.id);
                  const dirty = isDirty(row);
                  return (
                    <ArRow key={row.id} row={row} rowIndex={rowIndex}
                      edit={getEdit(row)} dirty={dirty}
                      isSelected={isSelected} selectedSize={selected.size}
                      showPeriod={!selectedPeriod}
                      eventOpts={eventOpts} impactOptions={impactOptions} docOpts={docOpts}
                      visibleRows={filtered} onToggle={toggleRow} onEdit={setEditField}
                      canCommitOne={!bulk && !bulkSaving && (dirty || isSelected)}
                      onCommitOne={r => setConfirmIds([r.id])} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Committed section ──────────────────────────────────── */}
      {!firstLoad && (
        <ArCommitted committed={committed} sessionCommitted={sessionCommitted} revertingIds={revertingIds}
          showPeriod={!selectedPeriod} committedOpen={committedOpen} setCommittedOpen={setCommittedOpen}
          onRevert={handleRevert} />
      )}

      {/* ── Commit confirmation modal ─────────────────────────── */}
      {confirmIds && (
        <ArConfirm toConfirm={filtered.filter(r => confirmIds.includes(r.id))} getEdit={getEdit} reasonFor={reasonFor}
          bulkSaving={bulkSaving} onCancel={() => setConfirmIds(null)} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
