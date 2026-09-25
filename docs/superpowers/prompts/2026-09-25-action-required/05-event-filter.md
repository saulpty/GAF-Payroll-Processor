# Action Required AR-5: filter by event, and "Needs an Event"

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these three files may change:**
- `src/app/pages/action-required/arLogic.ts` (whole file; adds `NEEDS_EVENT` and `filterByEvent`)
- **New** `src/app/pages/action-required/ArToolbar.tsx`
- `src/app/pages/ActionRequired.tsx` (whole file)

No other file may be touched.

## What Saul sees
Above the table: an **Event** dropdown (searchable, `All Events` by default) that shows rows whose
Event 1 or Event 2 matches; a **Needs an Event N** chip that shows only rows with no Event 1
yet; and `Showing X of Y`. The filter uses the saved values, so a row stays in view while it is
edited and leaves once committed. Changing the period resets the filter. Sorting by Event 1 and
Impact 1 arrived in AR-4.

## `src/app/pages/action-required/arLogic.ts` (whole file)

```ts
// Action Required: pure helpers (no React). Split out of ActionRequired.tsx, AR-1.
// Behaviour is byte-for-byte what the page did inline; tests/arLogic.test.ts pins it.

type Row = { id: number; employee_name: string; work_date: string; initial_status: string };

/** RED or YELLOW tab, then the name/date search, then the column sort. */
export function filterRows<T extends Row>(
  rows: T[], tab: 'RED' | 'YELLOW', search: string,
  sortKey: keyof T | null, sortDir: 'asc' | 'desc' | null,
): T[] {
  let out = rows.filter(r => r.initial_status === tab);
  const q = search.trim().toLowerCase();
  if (q) out = out.filter(r => r.employee_name.toLowerCase().includes(q) || r.work_date.toLowerCase().includes(q));
  if (sortKey && sortDir) {
    out = [...out].sort((a, b) => {
      const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }
  return out;
}

/** Header click cycles asc → desc → off. Returns the next [key, dir]. */
export function nextSort<K>(current: K | null, dir: 'asc' | 'desc' | null, clicked: K): [K | null, 'asc' | 'desc' | null] {
  if (current !== clicked) return [clicked, 'asc'];
  if (dir === 'asc') return [clicked, 'desc'];
  if (dir === 'desc') return [null, null];
  return [clicked, 'asc'];
}

/** The event box a row needs before it can commit: an impact was picked with no event. */
export function missingEvent(edit: { event_type_1: string; pay_impact_1: string; event_type_2: string; pay_impact_2: string }): 1 | 2 | null {
  if (edit.pay_impact_1 && !edit.event_type_1) return 1;
  if (edit.pay_impact_2 && !edit.event_type_2) return 2;
  return null;
}

/**
 * Why a row cannot be committed, or null when it can. isRealTime is
 * parseTimeInput's isValidTimeInput (passed in so this file stays import-free).
 */
export function refusalReason(
  edit: { entry_time: string; exit_time: string; event_type_1: string; pay_impact_1: string; event_type_2: string; pay_impact_2: string },
  isRealTime: (t: string) => boolean,
): string | null {
  if (!isRealTime(edit.entry_time) || !isRealTime(edit.exit_time)) return 'Entry or Exit is not a real time';
  if (missingEvent(edit)) return 'Pick an event first';
  return null;
}

/** The bulk bar is for bulk: two or more selected rows. One row commits from its own button. */
export function showBulkBar(selectedCount: number): boolean {
  return selectedCount >= 2;
}

/** Minutes for people: 45 → "45 min", 60 → "1h", 75 → "1h 15m". 0 or less → "". */
export function fmtMinutes(n: number | null | undefined): string {
  const m = Math.round(Number(n) || 0);
  if (m <= 0) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/**
 * The Discount column (AR-4): what a commit would deduct, from computeDiscount.
 * Nothing deducted with an event chosen → "Paid"; nothing and no event → blank.
 */
export function discountLabel(discount: number, hasEvent: boolean): { text: string; tone: 'deduct' | 'paid' | 'none' } {
  if (discount > 0) return { text: fmtMinutes(discount), tone: 'deduct' };
  return hasEvent ? { text: 'Paid', tone: 'paid' } : { text: '', tone: 'none' };
}

/** Event filter value meaning "rows with no Event 1 yet" (AR-5). */
export const NEEDS_EVENT = '__needs_event__';

/** AR-5 event filter: '' = all rows; NEEDS_EVENT = no Event 1; otherwise Event 1 or Event 2 equals it. */
export function filterByEvent<T>(rows: T[], filter: string, eventsOf: (r: T) => [string, string]): T[] {
  if (!filter) return rows;
  if (filter === NEEDS_EVENT) return rows.filter(r => !eventsOf(r)[0]);
  return rows.filter(r => eventsOf(r).includes(filter));
}

/** Ids between two visible indexes, inclusive, in visible order (shift-click range). */
export function rangeIds(visible: { id: number }[], a: number, b: number): number[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return visible.slice(lo, hi + 1).map(r => r.id);
}
```

## `src/app/pages/action-required/ArToolbar.tsx` (whole file)

```tsx
import { Combobox } from '@/app/components/ds/Combobox';
import { NEEDS_EVENT } from './arLogic';

/** AR-5: filter the work table by event, or show only rows that still need one. */
export function ArToolbar({ eventOpts, eventFilter, setEventFilter, needsEventCount, shown, total }: {
  eventOpts: string[];
  eventFilter: string;
  setEventFilter: (v: string) => void;
  needsEventCount: number;
  shown: number;
  total: number;
}) {
  const needsOn = eventFilter === NEEDS_EVENT;
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
        Event
        <Combobox value={needsOn ? '' : eventFilter} options={eventOpts} onChange={setEventFilter}
          placeholder="All Events" ariaLabel="Filter by event" className="w-48" />
      </label>
      <button type="button" aria-pressed={needsOn} onClick={() => setEventFilter(needsOn ? '' : NEEDS_EVENT)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${
          needsOn ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        }`}>
        Needs an Event <span className="font-bold tabular-nums">{needsEventCount}</span>
      </button>
      <span className="text-[12px] text-slate-500">
        {shown === total ? `Showing all ${total}` : `Showing ${shown} of ${total}`}
      </span>
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

          <ArCommitBar someSelected={bulk} selectedCount={selectedCount} selectedSize={selected.size}
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
```

## Report
- Byte size of the three files (each under 15 KB); confirm no other file changed and
  `/action-required` renders with no console errors.
