# AR-10: "Needs an Event" clears itself when done; lighter Committed list

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these two files may change** (replace each whole file):
1. `src/app/pages/ActionRequired.tsx`
2. `src/app/pages/action-required/ArCommitted.tsx`

No other file may be touched.

## Why (Saul and Tim, after 8.15.0)
- **"Needs an Event: when he acts on all of those, it should be automatically unfiltered
  instead of waiting for a manual click and an empty page."** When a filtered view that had
  rows becomes empty because they were all handled, the filter clears itself and a toast says
  `All done in that filter. Showing every row.` Picking a filter that simply has no matches does
  **not** clear it.
- **Tim's laptop struggled.** With All periods the Committed list drew every committed row
  (1,300+, about 16,000 elements). It now draws the latest 100 (newest first, as before) with
  `Showing the latest 100 of N` and a `Show All` button.

## `src/app/pages/ActionRequired.tsx` (whole file)

```tsx
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { filterRows, filterByEvent, nextSort, rangeIds, showBulkBar, NEEDS_EVENT } from './action-required/arLogic';
import { ArToolbar } from './action-required/ArToolbar';
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
  const { saveRow, revertRow, restoreRow } = useArSave(getEdit);
  const { commitRows, handleRevert, reasonFor, bulkSaving, sessionCommitted, setSessionCommitted, revertingIds, hiddenIds } =
    useArCommit({ rows, getEdit, saveRow, revertRow, restoreRow, reload, reloadCommitted, markSaved, bumpArVersion, toast });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [committedOpen, setCommittedOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  // Rows waiting in the confirm dialog: the bulk selection, or one row's own Commit button.
  const [confirmIds, setConfirmIds] = useState<number[] | null>(null);
  // AR-5: '' (all), NEEDS_EVENT, or an event name. Filters on the loaded (saved) values,
  // so a row stays in view while it is being edited and leaves only once committed.
  const [eventFilter, setEventFilter] = useState('');

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
    setEventFilter('');
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
  const eventsOf = useCallback((r: EntryRow): [string, string] => [r.event_type_1 || '', r.event_type_2 || ''], []);
  const tabRows = useMemo(
    () => filterRows(allRows, activeTab, globalEmployee, sortKey, sortDir),
    [allRows, activeTab, globalEmployee, sortKey, sortDir],
  );
  const filtered = useMemo(() => filterByEvent(tabRows, eventFilter, eventsOf), [tabRows, eventFilter, eventsOf]);
  const needsEventCount = useMemo(() => filterByEvent(tabRows, NEEDS_EVENT, eventsOf).length, [tabRows, eventsOf]);
  // AR-10: when the rows in a filtered view are all handled (e.g. the last "Needs an Event"
  // row committed), drop the filter instead of leaving an empty table. Picking a filter
  // that simply has no matches does not clear it (the filter must have had rows first).
  const lastView = useRef({ filter: '', count: 0 });
  useEffect(() => {
    const was = lastView.current;
    if (eventFilter && eventFilter === was.filter && was.count > 0 && filtered.length === 0 && !loading) {
      setEventFilter('');
      toast.show({ message: 'All done in that filter. Showing every row.' });
    }
    lastView.current = { filter: eventFilter, count: filtered.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFilter, filtered.length, loading]);

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
    <div className={`flex flex-col h-full p-5 gap-4 overflow-hidden ${bulk ? 'pb-20' : ''}`}>

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

          <ArCommitBar someSelected={bulk} selectedCount={selectedCount} selectedSize={selectedCount}
            bulkSaving={bulkSaving} dirtyCount={dirtyCount}
            onDeselectAll={() => setSelected(new Set())}
            onCommit={() => setConfirmIds(filtered.filter(r => selected.has(r.id)).map(r => r.id))}
            onDiscardAll={discardAll} />

          {/* ── Work table ─────────────────────────────────────── */}
          <ArToolbar eventOpts={eventOpts} eventFilter={eventFilter} setEventFilter={setEventFilter}
            needsEventCount={needsEventCount} shown={filtered.length} total={tabRows.length} />

          {/* While data refreshes the table stays put but dims and ignores clicks, so the
              previous period's rows can never be edited or committed by mistake. */}
          <div className={`flex-1 min-h-0 rounded-xl border border-slate-200 bg-white shadow-card overflow-auto transition-opacity ${loading ? 'opacity-60 pointer-events-none' : ''}`}
            aria-busy={loading || undefined}>
            <table className="w-full border-separate border-spacing-0 tabular-nums" style={{ minWidth: 1880 }}>
              <ArHead allFilteredSelected={allFilteredSelected} someSelected={someSelected} showPeriod={!selectedPeriod}
                sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onToggleAll={toggleSelectAll} />
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={17} className="px-4 py-8 text-center text-muted-foreground text-sm">No results match your filter.</td></tr>
                )}
                {filtered.map((row, rowIndex) => {
                  const isSelected = selected.has(row.id);
                  const dirty = isDirty(row);
                  return (
                    <ArRow key={row.id} row={row} rowIndex={rowIndex}
                      edit={getEdit(row)} dirty={dirty}
                      isSelected={isSelected} selectedSize={selectedCount}
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
```

## `src/app/pages/action-required/ArCommitted.tsx` (whole file)

```tsx
import { useState } from 'react';
import { CheckCircle2, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtTime } from '@/app/lib/fmtTime';
import type { CommittedRow } from './arTypes';
import { IMPACT_DOT, impactTone } from './arLogic';

const THIS_YEAR = toLocalYMD(new Date()).slice(0, 4);
const th = 'px-3 py-2 text-left text-[12px] font-semibold text-slate-600 whitespace-nowrap bg-slate-50 border-b border-slate-200';
const td = 'px-3 py-2 border-b border-slate-100';
const WAS: Record<string, string> = {
  RED: 'bg-status-red-fill text-status-red-ink',
  YELLOW: 'bg-status-yellow-fill text-status-yellow-ink',
  GREEN: 'bg-status-green-fill text-status-green-ink',
};
const cap = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const dash = <span className="text-slate-300">—</span>;
/** An impact with its colour dot (AR-9): green paid, amber with grace, red unpaid. */
const impact = (v: string | null | undefined) => v
  ? <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 shrink-0 rounded-full ${IMPACT_DOT[impactTone(v)]}`} aria-hidden="true" />{v}</span>
  : dash;
/** "Fri Sep 25 · 6:58PM" from the stored updated_at text (no timezone conversion, as before). */
const fmtUpdated = (u: string | null | undefined) =>
  u ? `${fmtDay(u.slice(0, 10), THIS_YEAR)} · ${fmtTime(u.slice(11, 16))}` : '';

/** The "Committed to Green" list with per-row revert (AR-6: Warm look; open state stays in the page). */
export function ArCommitted({ committed, sessionCommitted, revertingIds, showPeriod, committedOpen, setCommittedOpen, onRevert }: {
  committed: CommittedRow[];
  sessionCommitted: Set<number>;
  revertingIds: Set<number>;
  showPeriod: boolean;
  committedOpen: boolean;
  setCommittedOpen: (f: (o: boolean) => boolean) => void;
  onRevert: (r: CommittedRow) => void;
}) {
  // AR-10: draw the latest 100 rows only (All periods has 1,300+, ~16k elements); "Show All" on request.
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? committed : committed.slice(0, 100);
  return (
    <div className="shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <button type="button" onClick={() => setCommittedOpen(o => !o)} aria-expanded={committedOpen}
        className="flex w-full items-center gap-3 border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-status-green-ink" />
        <span className="text-[14px] font-semibold text-slate-800">Committed to Green</span>
        <span className="rounded-full bg-status-green-fill px-2 py-0.5 text-[12px] font-semibold tabular-nums text-status-green-ink">{committed.length}</span>
        {sessionCommitted.size > 0 && <span className="text-[12px] text-slate-500">{sessionCommitted.size} this session</span>}
        <ChevronRight className={`ml-auto w-4 h-4 text-slate-400 transition-transform ${committedOpen ? 'rotate-90' : ''}`} />
      </button>

      {committedOpen && (
        committed.length === 0 ? (
          <div className="px-4 py-6 text-center text-[13px] text-slate-500">
            Nothing committed yet. Pick an event and impact above, then commit the row.
          </div>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-[13px] tabular-nums" style={{ minWidth: 980 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={th}>Employee</th>
                  {showPeriod && <th className={th}>Period</th>}
                  <th className={th}>Date</th>
                  <th className={th}>Was</th>
                  <th className={th}>Event 1</th>
                  <th className={th}>Impact 1</th>
                  <th className={th}>Event 2</th>
                  <th className={th}>Impact 2</th>
                  <th className={th}>Doc</th>
                  <th className={th}>Notes</th>
                  <th className={th}>Updated</th>
                  <th className={th}><span className="sr-only">Revert</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const isNew = sessionCommitted.has(r.id);
                  const reverting = revertingIds.has(r.id);
                  return (
                    <tr key={r.id} className={isNew ? 'bg-status-green-tint' : 'hover:bg-slate-50'}>
                      <td className={`${td} font-medium text-slate-800 whitespace-nowrap`}>
                        {isNew && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-status-green-ink align-middle" title="Committed this session" />}
                        {r.employee_name}
                      </td>
                      {showPeriod && <td className={`${td} whitespace-nowrap text-slate-600`}>{r.period_name}</td>}
                      <td className={`${td} whitespace-nowrap text-slate-700`}>{r.work_date ? fmtDay(r.work_date.slice(0, 10), THIS_YEAR) : dash}</td>
                      <td className={td}>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${WAS[r.initial_status] || ''}`}>{cap(r.initial_status)}</span>
                      </td>
                      <td className={`${td} text-slate-700`}>{r.event_type_1 || dash}</td>
                      <td className={`${td} text-slate-700`}>{impact(r.pay_impact_1)}</td>
                      <td className={`${td} text-slate-700`}>{r.event_type_2 || dash}</td>
                      <td className={`${td} text-slate-700`}>{impact(r.pay_impact_2)}</td>
                      <td className={`${td} text-slate-600`}>{r.documentation || dash}</td>
                      <td className={`${td} max-w-40 truncate text-slate-500`} title={r.notes || undefined}>{r.notes || dash}</td>
                      <td className={`${td} whitespace-nowrap text-[12px] text-slate-500`}>{fmtUpdated(r.updated_at)}</td>
                      <td className={`${td} text-center`}>
                        <button type="button" title={`Revert to ${cap(r.initial_status)}`} aria-label={`Revert ${r.employee_name} ${r.work_date?.slice(0, 10)} to ${cap(r.initial_status)}`}
                          disabled={reverting} onClick={() => onRevert(r)}
                          className="rounded-md p-1 text-slate-400 hover:bg-warm-tint hover:text-warm-text disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
                          {reverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {committed.length > shown.length && (
              <div className="flex items-center justify-center gap-3 border-t border-slate-100 px-3 py-2 text-[12px] text-slate-500">
                Showing the latest {shown.length} of {committed.length}
                <button type="button" onClick={() => setShowAll(true)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-0.5 font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
                  Show All
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
```

## Report
- Byte size of both files (each under 15 KB); confirm no other file changed and `/action-required`
  renders with no console errors.
