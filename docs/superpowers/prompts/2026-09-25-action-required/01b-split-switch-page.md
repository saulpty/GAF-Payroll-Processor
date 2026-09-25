# Action Required AR-1b: switch the page to the split files, no visible change

Part 2 of 2 (AR-1a already created `arTypes.ts`, `arLogic.ts`, `ArBits.tsx`, `ArHead.tsx`,
`ArCommitBar.tsx`, `ArConfirm.tsx`, `useArSave.ts` in `src/app/pages/action-required/`).

**Only these files may change:**
- **New** `src/app/pages/action-required/ArRow.tsx` and `ArCommitted.tsx`, exactly as below.
- `src/app/pages/ActionRequired.tsx`: replace the whole file with the shell below.

**The page must look and behave exactly as before.** No other file may be touched: not the
AR-1a files, not `app.tsx`, any action, `classificationEngine.ts`, `punchMinutes.ts`,
`useRowEdits.ts`, `TimeInput.tsx`, `FilterBar.tsx`, `PayrollMaster.tsx`, or `src/components/ui/`.
Copy exactly; do not tidy.

## `src/app/pages/action-required/ArRow.tsx`

```tsx
import { CheckSquare, Square } from 'lucide-react';
import { TimeInput } from '@/app/components/TimeInput';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import { BroadcastSelect } from './ArBits';
import type { EditState, EntryRow } from './arTypes';

/** One editable row of the work table. Split out of ActionRequired.tsx, AR-1. */
export function ArRow({
  row, rowIndex, edit, dirty, isSelected, selectedSize, showPeriod,
  eventOpts, impactOptions, docOpts, visibleRows, onToggle, onEdit,
}: {
  row: EntryRow; rowIndex: number; edit: EditState; dirty: boolean;
  isSelected: boolean; selectedSize: number; showPeriod: boolean;
  eventOpts: string[]; impactOptions: string[]; docOpts: string[];
  visibleRows: EntryRow[];
  onToggle: (id: number, index: number, shiftKey: boolean) => void;
  onEdit: (id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => void;
}) {
  const live = dirty ? computePunchMinutes({
    entry_time: edit.entry_time, exit_time: edit.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  }) : null;
  const lateShown = live ? live.late_minutes : row.late_minutes;
  const earlyShown = live ? live.early_leave_minutes : row.early_leave_minutes;
  const broadcasting = isSelected && selectedSize > 1;
  const rowBg = isSelected
    ? 'bg-blue-50'
    : dirty
      ? row.initial_status === 'RED' ? 'bg-red-50' : 'bg-amber-50/70'
      : row.initial_status === 'RED' ? 'bg-[#FFF0F0]' : 'bg-[#FFFBEB]';

  return (
    <tr className={`${rowBg} border-b hover:brightness-[0.97] transition-colors ${isSelected ? 'ring-1 ring-inset ring-blue-300' : ''}`}>
      {/* Checkbox */}
      <td className={`px-2 py-2 w-8 border-r sticky left-0 z-10 ${rowBg}`}>
        <button onClick={e => onToggle(row.id, rowIndex, e.shiftKey)} className="flex items-center justify-center w-full">
          {isSelected
            ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
            : <Square className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />}
        </button>
      </td>
      {/* Frozen employee */}
      <td className={`px-3 py-2 font-medium whitespace-nowrap border-r sticky left-8 z-10 ${rowBg}`}>
        <span
          role="button"
          tabIndex={0}
          aria-pressed={isSelected}
          onClick={e => onToggle(row.id, rowIndex, e.shiftKey)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { if (e.key === ' ') e.preventDefault(); onToggle(row.id, rowIndex, e.shiftKey); } }}
          className="cursor-pointer hover:text-blue-700 transition-colors"
        >{row.employee_name}</span>
      </td>
      {showPeriod && <td className="px-3 py-1.5 border-r whitespace-nowrap text-slate-600">{row.period_name}</td>}
      <td className="px-3 py-2 whitespace-nowrap border-r font-mono text-slate-700">{row.work_date.slice(0, 10)}</td>
      {/* Entry/Exit */}
      <td className="px-1 py-1.5 border-r w-24 bg-blue-50/40" style={{ width: 112, minWidth: 112 }}>
        <TimeInput className="w-full border rounded px-1 py-1 text-xs bg-white font-mono"
          value={edit.entry_time} placeholder="9:00 AM"
          onChange={v => onEdit(row.id, 'entry_time', v, row)} />
      </td>
      <td className="px-1 py-1.5 border-r w-24 bg-blue-50/40" style={{ width: 112, minWidth: 112 }}>
        <TimeInput className="w-full border rounded px-1 py-1 text-xs bg-white font-mono"
          value={edit.exit_time} placeholder="5:00 PM"
          onChange={v => onEdit(row.id, 'exit_time', v, row)} />
      </td>
      <td className="px-3 py-2 whitespace-nowrap border-r text-slate-500 text-[11px]">{row.scheduled_start}–{row.scheduled_end}</td>
      <td className="px-3 py-2 text-center border-r">
        {lateShown > 0 ? <span className={`font-semibold ${live && lateShown !== row.late_minutes ? 'text-amber-600' : 'text-red-700'}`}>{lateShown}</span> : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-2 text-center border-r">
        {earlyShown > 0 ? <span className={`font-semibold ${live && earlyShown !== row.early_leave_minutes ? 'text-amber-600' : 'text-orange-600'}`}>{earlyShown}</span> : <span className="text-slate-300">—</span>}
      </td>
      {/* Event 1 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.event_type_1} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'event_type_1', v, row, visibleRows)}
          placeholder="— none —" options={eventOpts} />
      </td>
      {/* Impact 1 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.pay_impact_1} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'pay_impact_1', v, row, visibleRows)}
          placeholder="— pick —" options={impactOptions} />
      </td>
      {/* Event 2 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.event_type_2} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'event_type_2', v, row, visibleRows)}
          placeholder="— none —" options={eventOpts} />
      </td>
      {/* Impact 2 */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <BroadcastSelect value={edit.pay_impact_2} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'pay_impact_2', v, row, visibleRows)}
          placeholder="— pick —" options={impactOptions} />
      </td>
      {/* Doc */}
      <td className="px-2 py-1.5 border-r min-w-28">
        <BroadcastSelect value={edit.documentation} broadcasting={broadcasting}
          onChange={v => onEdit(row.id, 'documentation', v, row, visibleRows)}
          placeholder="—" options={docOpts} />
      </td>
      {/* Auto-notes */}
      <td className="px-3 py-2 border-r text-slate-500 max-w-52 text-[11px]">
        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
      </td>
      {/* Notes */}
      <td className="px-2 py-1.5 border-r min-w-36">
        <input className="w-full border rounded px-1.5 py-1 text-xs bg-white" value={edit.notes}
          placeholder="add note…" onChange={e => onEdit(row.id, 'notes', e.target.value, row)} />
      </td>
    </tr>
  );
}
```

## `src/app/pages/action-required/ArCommitted.tsx`

```tsx
import { GitCommit, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_CHIP, type CommittedRow } from './arTypes';

/** The "Committed to GREEN" list with per-row revert. Split out of ActionRequired.tsx, AR-1.
 *  Open/closed state stays in the page so it survives reloads, as before. */
export function ArCommitted({ committed, sessionCommitted, revertingIds, showPeriod, committedOpen, setCommittedOpen, onRevert }: {
  committed: CommittedRow[];
  sessionCommitted: Set<number>;
  revertingIds: Set<number>;
  showPeriod: boolean;
  committedOpen: boolean;
  setCommittedOpen: (f: (o: boolean) => boolean) => void;
  onRevert: (r: CommittedRow) => void;
}) {
  return (
    <div className="shrink-0 border rounded-xl overflow-hidden shadow-sm">
      {/* Section header */}
      <button
        onClick={() => setCommittedOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 border-b border-green-200 hover:bg-green-100 transition-colors text-left"
      >
        <GitCommit className="w-4 h-4 text-green-600 shrink-0" />
        <span className="text-sm font-semibold text-green-800">Committed to GREEN</span>
        <Badge className="bg-green-600 text-white text-xs ml-1">{committed.length}</Badge>
        {sessionCommitted.size > 0 && (
          <span className="text-xs text-green-600 font-medium ml-1">({sessionCommitted.size} this session)</span>
        )}
        <ChevronRight className={`w-4 h-4 text-green-500 ml-auto transition-transform ${committedOpen ? 'rotate-90' : ''}`} />
      </button>

      {committedOpen && (
        committed.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground bg-white">
            <GitCommit className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            No committed entries yet — select rows above, fill in the event/pay impact fields, and click <strong>Commit to GREEN</strong>.
          </div>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs border-collapse tabular-nums" style={{ minWidth: 900 }}>
              <thead className="sticky top-0 bg-green-50 border-b border-green-200 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Employee</th>
                  {showPeriod && <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Period</th>}
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Was</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Event 1</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Pay Impact 1</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Event 2</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Pay Impact 2</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Doc</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700 border-r">Notes</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700">Updated</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-700"></th>
                </tr>
              </thead>
              <tbody>
                {committed.map(r => {
                  const isNew = sessionCommitted.has(r.id);
                  return (
                    <tr key={r.id} className={`border-b last:border-b-0 transition-colors ${isNew ? 'bg-green-50' : 'bg-white hover:bg-slate-50'}`}>
                      <td className="px-3 py-2 border-r font-medium">
                        {isNew && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />}
                        {r.employee_name}
                      </td>
                      {showPeriod && <td className="px-3 py-1.5 border-r whitespace-nowrap text-slate-600">{r.period_name}</td>}
                      <td className="px-3 py-2 border-r font-mono text-slate-600">{r.work_date?.slice(0, 10)}</td>
                      <td className="px-3 py-2 border-r">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_CHIP[r.initial_status] || ''}`}>{r.initial_status}</span>
                      </td>
                      <td className="px-3 py-2 border-r text-slate-700">{r.event_type_1 || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 border-r">
                        {r.pay_impact_1
                          ? <span className="text-blue-700 font-medium">{r.pay_impact_1}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-r text-slate-700">{r.event_type_2 || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 border-r">
                        {r.pay_impact_2
                          ? <span className="text-blue-700 font-medium">{r.pay_impact_2}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 border-r text-slate-600">{r.documentation || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 border-r text-slate-500 max-w-40 truncate">{r.notes || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2 text-slate-400 text-[11px] font-mono whitespace-nowrap">{r.updated_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          title={`Revert to ${r.initial_status}`}
                          disabled={revertingIds.has(r.id)}
                          onClick={() => onRevert(r)}
                          className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                        >
                          {revertingIds.has(r.id)
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <RotateCcw className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
```

## `src/app/pages/ActionRequired.tsx` (whole file)

```tsx
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
import { BROADCAST_FIELDS, toEditState, type CommittedRow, type EditState, type EntryRow, type SortDir, type SortKey } from './action-required/arTypes';
import { filterRows, nextSort, rangeIds } from './action-required/arLogic';
import { ArHead } from './action-required/ArHead';
import { ArCommitBar } from './action-required/ArCommitBar';
import { ArRow } from './action-required/ArRow';
import { ArCommitted } from './action-required/ArCommitted';
import { ArConfirm } from './action-required/ArConfirm';
import { useArSave } from './action-required/useArSave';

export default function ActionRequired() {
  const { period: selectedPeriod, employee: globalEmployee, statusTab: activeTab } = useGlobalFilters();
  const [payImpacts] = useLoadAction(loadPayImpactsAction, [] as { name: string }[]);
  const [docOptions] = useLoadAction(loadDocumentationOptionsAction, [] as { name: string }[]);
  const [eventTypes] = useLoadAction(loadEventTypesAction, [] as { id: number; name: string }[]);
  const [eventRulesRaw] = useLoadAction(loadEventTypeRulesAction, [] as { event_type: string; default_pay_impact: string; default_doc_option: string }[]);

  const [params, setParams] = useState({ periodName: selectedPeriod });
  const [rows, loading, , reload] = useLoadAction(loadActionRequiredAction, [] as EntryRow[], params);
  const { getEdit, update, isDirty, discardAll, markSaved, dirtyCount } = useRowEdits<EntryRow, EditState>(toEditState, rows as EntryRow[]);
  const [committedRows, , , reloadCommitted] = useLoadAction(loadCommittedEntriesAction, [] as CommittedRow[], params);
  const { saveRow, revertRow } = useArSave(getEdit);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [committedOpen, setCommittedOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  // Track IDs committed this session for highlighting
  const [sessionCommitted, setSessionCommitted] = useState<Set<number>>(new Set());
  const [revertingIds, setRevertingIds] = useState<Set<number>>(new Set());
  const [showCommitConfirm, setShowCommitConfirm] = useState(false);

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

  const setEditField = useCallback((id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => {
    const isBroadcast = BROADCAST_FIELDS.includes(field) && selected.has(id) && selected.size > 1;
    const targetIds = isBroadcast ? Array.from(selected) : [id];
    const rowMap = new Map((allRows ?? []).map(r => [r.id, r]));

    for (const tid of targetIds) {
      const trow = rowMap.get(tid) ?? row;
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
    // auto-select the touched row
    setSelected(prev => new Set(prev).add(id));
  }, [update, rulesMap, selected]);

  const allRows = rows as EntryRow[];
  const filtered = useMemo(
    () => filterRows(allRows, activeTab, globalEmployee, sortKey, sortDir),
    [allRows, activeTab, globalEmployee, sortKey, sortDir],
  );

  // Bulk commit selected rows
  const handleBulkCommit = async () => {
    setShowCommitConfirm(false);
    const toSave = filtered.filter(r => selected.has(r.id));
    if (!toSave.length) return;
    setBulkSaving(true);
    const newCommitted = new Set(sessionCommitted);
    const refused: string[] = [];
    for (const row of toSave) {
      const status = await saveRow(row);
      if (status === null) { refused.push(`${row.employee_name} ${row.work_date.slice(0, 10)}`); continue; }
      newCommitted.add(row.id);
      markSaved(row.id);
    }
    setSessionCommitted(newCommitted);
    setSelected(new Set());
    setBulkSaving(false);
    if (refused.length) window.alert(`Not committed — Entry and Exit must look like 9:05 AM:\n${refused.join('\n')}`);
    await reload();
    await reloadCommitted();
  };

  const handleRevert = async (r: CommittedRow) => {
    setRevertingIds(prev => new Set(prev).add(r.id));
    try {
      await revertRow(r);
      setSessionCommitted(prev => { const s = new Set(prev); s.delete(r.id); return s; });
      await reload();
      await reloadCommitted();
    } finally {
      setRevertingIds(prev => { const s = new Set(prev); s.delete(r.id); return s; });
    }
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

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">

      {/* ── Empty states ────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading entries…</div>
      )}
      {!loading && allRows.length === 0 && (
        <Card className="border-green-300 bg-green-50 flex-1">
          <CardContent className="pt-12 text-center">
            <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-green-800 font-semibold text-base">{selectedPeriod ? `All clear for ${selectedPeriod}!` : 'All clear — all periods!'}</p>
            <p className="text-green-700 text-sm mt-1">No unresolved entries.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      {!loading && allRows.length > 0 && (
        <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">

          <ArCommitBar someSelected={someSelected} selectedCount={selectedCount} selectedSize={selected.size}
            bulkSaving={bulkSaving} dirtyCount={dirtyCount}
            onDeselectAll={() => setSelected(new Set())} onCommit={() => setShowCommitConfirm(true)} onDiscardAll={discardAll} />

          {/* ── Work table ─────────────────────────────────────── */}
          <div className="flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto">
            <table className="w-full text-xs border-collapse tabular-nums" style={{ minWidth: 1120 }}>
              <ArHead allFilteredSelected={allFilteredSelected} someSelected={someSelected} showPeriod={!selectedPeriod}
                sortKey={sortKey} sortDir={sortDir} onSort={handleSort} onToggleAll={toggleSelectAll} />
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={15} className="px-4 py-8 text-center text-muted-foreground text-sm">No results match your filter.</td></tr>
                )}
                {filtered.map((row, rowIndex) => (
                  <ArRow key={row.id} row={row} rowIndex={rowIndex}
                    edit={getEdit(row)} dirty={isDirty(row)}
                    isSelected={selected.has(row.id)} selectedSize={selected.size}
                    showPeriod={!selectedPeriod}
                    eventOpts={eventOpts} impactOptions={impactOptions} docOpts={docOpts}
                    visibleRows={filtered} onToggle={toggleRow} onEdit={setEditField} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Committed section ──────────────────────────────────── */}
      {!loading && (
        <ArCommitted committed={committed} sessionCommitted={sessionCommitted} revertingIds={revertingIds}
          showPeriod={!selectedPeriod} committedOpen={committedOpen} setCommittedOpen={setCommittedOpen}
          onRevert={handleRevert} />
      )}

      {/* ── Commit confirmation modal ─────────────────────────── */}
      {showCommitConfirm && (
        <ArConfirm toConfirm={filtered.filter(r => selected.has(r.id))} getEdit={getEdit} bulkSaving={bulkSaving}
          onCancel={() => setShowCommitConfirm(false)} onConfirm={handleBulkCommit} />
      )}
    </div>
  );
}
```

## Report
- Byte size of the three files (each under 15 KB).
- Confirm no other file changed.
- Open `/action-required` in preview and confirm it renders with no console errors.
