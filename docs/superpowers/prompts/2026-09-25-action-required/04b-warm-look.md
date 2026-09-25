# Action Required AR-4b: the Warm look (Saul approved Warm + Title Case)

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

Read `src/DESIGN.md`. **Only these four files may change:**
- `src/app/pages/action-required/ArRow.tsx` (whole file)
- `src/app/pages/action-required/ArHead.tsx` (whole file)
- `src/app/pages/action-required/ArCommitBar.tsx` (whole file; same props as before)
- `src/app/pages/ActionRequired.tsx`: exactly four small edits, listed at the end.

No other file may be touched: not `src/components/ui/*`, not `FilterBar.tsx` or `TopNav.tsx` (the
page-by-page rollout restyles only this page's own content), not `classificationEngine.ts`
(`computeDiscount` and `toLocalYMD` are only imported), not the save or commit hooks.

## What Saul sees
- Title Case headers (never uppercase); fixed column widths; sort by Employee, Date, Late,
  Early, **Event 1** and **Impact 1**.
- Dates `Wed Sep 16` (`fmtDay`); a **Shift** column `Mon–Fri · 9AM–5PM` (`fmtShift`, with the
  work days loaded in AR-4a); minutes as `45 min` / `1h 15m`.
- A live **Discount** column: what a commit would deduct right now, from the same
  `computeDiscount` the save uses (`14 min` in red, or `Paid` in green).
- Searchable dropdowns (`ds/Combobox`) with a clear ×; the Event box turns red and pulses with
  `Pick an event first` when an impact is chosen first.
- Selected rows: warm tint plus an orange bar on the left; unsaved rows show an orange dot.
- The bulk bar floats at the bottom (`ds/BulkBar`), only for 2+ rows; one row has an orange
  `Commit` pill next to the name.

## `src/app/pages/action-required/ArRow.tsx` (whole file)

```tsx
import { Check, Send } from 'lucide-react';
import { TimeInput } from '@/app/components/TimeInput';
import { Combobox } from '@/app/components/ds/Combobox';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import { computeDiscount, toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtShift } from '@/app/lib/fmtTime';
import { discountLabel, fmtMinutes, missingEvent } from './arLogic';
import type { EditState, EntryRow } from './arTypes';

const THIS_YEAR = toLocalYMD(new Date()).slice(0, 4);
const td = 'px-2 py-1.5 border-b border-slate-100';
const timeBox = 'w-full h-7 rounded-md border border-slate-300 bg-white px-1.5 text-[12px] tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring';

/** One editable row of the work table (AR-4: Warm look, per src/DESIGN.md). */
export function ArRow({
  row, rowIndex, edit, dirty, isSelected, selectedSize, showPeriod,
  eventOpts, impactOptions, docOpts, visibleRows, onToggle, onEdit, canCommitOne, onCommitOne,
}: {
  row: EntryRow; rowIndex: number; edit: EditState; dirty: boolean;
  isSelected: boolean; selectedSize: number; showPeriod: boolean;
  eventOpts: string[]; impactOptions: string[]; docOpts: string[];
  visibleRows: EntryRow[];
  onToggle: (id: number, index: number, shiftKey: boolean) => void;
  onEdit: (id: number, field: keyof EditState, value: string, row: EntryRow, allRows?: EntryRow[]) => void;
  /** Show this row's own Commit button (one-offs; the bulk bar is for 2+ rows). */
  canCommitOne: boolean;
  onCommitOne: (row: EntryRow) => void;
}) {
  const needsEvent = missingEvent(edit);
  const live = dirty ? computePunchMinutes({
    entry_time: edit.entry_time, exit_time: edit.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  }) : null;
  const late = live ? live.late_minutes : row.late_minutes;
  const early = live ? live.early_leave_minutes : row.early_leave_minutes;
  // What a commit would deduct right now: the same computeDiscount the save uses.
  const discount = discountLabel(computeDiscount({
    event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
    event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
    late_minutes: late, late_after_grace: live ? live.late_after_grace : row.late_after_grace,
    early_leave_minutes: early,
  }), !!(edit.event_type_1 || edit.event_type_2));
  const broadcasting = isSelected && selectedSize > 1;
  const tint = isSelected ? 'bg-warm-tint' : row.initial_status === 'RED' ? 'bg-status-red-tint' : 'bg-status-yellow-tint';
  const bar = isSelected ? 'shadow-[inset_3px_0_0_var(--warm)]' : '';
  const pick = (field: keyof EditState) => (v: string) => onEdit(row.id, field, v, row, visibleRows);
  const combo = (field: keyof EditState, value: string, options: string[], label: string, invalid = false) => (
    <div className={broadcasting ? 'rounded-md ring-1 ring-warm-ring' : ''} title={broadcasting ? `Applies to all ${selectedSize} selected rows` : undefined}>
      <Combobox value={value} options={options} onChange={pick(field)} ariaLabel={`${label}, ${row.employee_name} ${row.work_date.slice(0, 10)}`}
        invalid={invalid} flashKey={invalid ? 1 : 0} className="w-full" />
    </div>
  );

  return (
    <tr className={`${tint} hover:brightness-[0.98] text-[13px] text-slate-800`}>
      <td className={`${td} sticky left-0 z-10 w-10 ${tint} ${bar}`}>
        <input type="checkbox" checked={isSelected} aria-label={`Select ${row.employee_name} ${row.work_date.slice(0, 10)}`}
          onChange={() => {}} onClick={e => onToggle(row.id, rowIndex, e.shiftKey)}
          className="h-4 w-4 rounded border-slate-400 accent-[var(--warm)] cursor-pointer" />
      </td>
      <td className={`${td} sticky left-10 z-10 ${tint}`} style={{ width: 176, minWidth: 176, maxWidth: 176 }}>
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium" title={row.employee_name}>{row.employee_name}</span>
          {dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warm" title="Unsaved changes" />}
          {canCommitOne && (
            <button type="button" onClick={() => onCommitOne(row)} title="Commit this row to Green"
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-warm px-2 py-0.5 text-[11px] font-semibold text-warm-ink hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
              <Send className="w-3 h-3" />Commit
            </button>
          )}
        </div>
      </td>
      {showPeriod && <td className={`${td} whitespace-nowrap text-slate-600`} style={{ width: 110 }}>{row.period_name}</td>}
      <td className={`${td} whitespace-nowrap text-slate-700`} style={{ width: 96 }}>{fmtDay(row.work_date.slice(0, 10), THIS_YEAR)}</td>
      <td className={td} style={{ width: 88, minWidth: 88 }}>
        <TimeInput className={timeBox} value={edit.entry_time} placeholder="9:00 AM" onChange={v => onEdit(row.id, 'entry_time', v, row)} />
      </td>
      <td className={td} style={{ width: 88, minWidth: 88 }}>
        <TimeInput className={timeBox} value={edit.exit_time} placeholder="5:00 PM" onChange={v => onEdit(row.id, 'exit_time', v, row)} />
      </td>
      <td className={`${td} whitespace-nowrap text-[12px] text-slate-500`} style={{ width: 150 }}>{fmtShift(row.work_days, row.scheduled_start, row.scheduled_end)}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${late > 0 ? 'font-semibold text-status-red-ink' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(late) || '—'}</td>
      <td className={`${td} text-right tabular-nums whitespace-nowrap ${early > 0 ? 'font-semibold text-status-yellow-ink' : 'text-slate-300'}`} style={{ width: 70 }}>{fmtMinutes(early) || '—'}</td>
      <td className={`${td} text-right`} style={{ width: 90 }}>
        {discount.tone === 'deduct' && <span className="inline-block rounded-full bg-status-red-tint px-2 py-0.5 text-[12px] font-semibold tabular-nums text-status-red-ink ring-1 ring-status-red-fill">{discount.text}</span>}
        {discount.tone === 'paid' && <span className="inline-flex items-center gap-1 rounded-full bg-status-green-fill px-2 py-0.5 text-[12px] font-semibold text-status-green-ink"><Check className="w-3 h-3" />Paid</span>}
        {discount.tone === 'none' && <span className="text-slate-300">—</span>}
      </td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_1', edit.event_type_1, eventOpts, 'Event 1', needsEvent === 1)}
        {needsEvent === 1 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_1', edit.pay_impact_1, impactOptions, 'Impact 1')}</td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_2', edit.event_type_2, eventOpts, 'Event 2', needsEvent === 2)}
        {needsEvent === 2 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_2', edit.pay_impact_2, impactOptions, 'Impact 2')}</td>
      <td className={td} style={{ width: 140, minWidth: 140 }}>{combo('documentation', edit.documentation, docOpts, 'Doc')}</td>
      <td className={`${td} text-[12px] text-slate-500`} style={{ maxWidth: 220 }}>
        <span title={row.auto_notes} className="block truncate">{row.auto_notes || <span className="text-slate-300">—</span>}</span>
      </td>
      <td className={td} style={{ minWidth: 180 }}>
        <input className="w-full h-7 rounded-md border border-slate-300 bg-white px-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
          value={edit.notes} placeholder="Add a note" onChange={e => onEdit(row.id, 'notes', e.target.value, row)} />
      </td>
    </tr>
  );
}
```

## `src/app/pages/action-required/ArHead.tsx` (whole file)

```tsx
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDir, SortKey } from './arTypes';

const th = 'px-2 py-2 text-left text-[12px] font-semibold text-slate-600 whitespace-nowrap bg-slate-100 border-b border-slate-200';

/** Sortable header cell: asc → desc → off. Title Case, never uppercase (src/DESIGN.md). */
function SortTh({ col, label, sortKey, sortDir, onSort, className = '', style, align = 'left' }: {
  col: Exclude<SortKey, null>; label: string; sortKey: SortKey; sortDir: SortDir; onSort: (c: SortKey) => void;
  className?: string; style?: React.CSSProperties; align?: 'left' | 'right';
}) {
  const active = sortKey === col && sortDir !== null;
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={`${th} ${className}`} style={style} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 rounded hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${align === 'right' ? 'flex-row-reverse w-full justify-start' : ''} ${active ? 'text-slate-900' : ''}`}>
        {label}
        <Icon className={`w-3 h-3 ${active ? 'text-warm-text' : 'opacity-40'}`} aria-hidden="true" />
      </button>
    </th>
  );
}

/** The work table's header row (AR-4: Warm look; widths match ArRow). */
export function ArHead({ allFilteredSelected, someSelected, showPeriod, sortKey, sortDir, onSort, onToggleAll }: {
  allFilteredSelected: boolean;
  someSelected: boolean;
  showPeriod: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  onToggleAll: () => void;
}) {
  const s = { sortKey, sortDir, onSort };
  return (
    <thead className="sticky top-0 z-20">
      <tr>
        <th className={`${th} sticky left-0 z-30 w-10`}>
          <input type="checkbox" aria-label="Select all visible rows" checked={allFilteredSelected}
            ref={el => { if (el) el.indeterminate = someSelected && !allFilteredSelected; }}
            onChange={onToggleAll} className="h-4 w-4 rounded border-slate-400 accent-[var(--warm)] cursor-pointer" />
        </th>
        <SortTh col="employee_name" label="Employee" className="sticky left-10 z-30" style={{ width: 176, minWidth: 176 }} {...s} />
        {showPeriod && <SortTh col="period_name" label="Period" style={{ width: 110 }} {...s} />}
        <SortTh col="work_date" label="Date" style={{ width: 96 }} {...s} />
        <th className={th} style={{ width: 88 }}>In</th>
        <th className={th} style={{ width: 88 }}>Out</th>
        <th className={th} style={{ width: 150 }}>Shift</th>
        <SortTh col="late_minutes" label="Late" align="right" style={{ width: 70 }} {...s} />
        <SortTh col="early_leave_minutes" label="Early" align="right" style={{ width: 70 }} {...s} />
        <th className={`${th} text-right`} style={{ width: 90 }}>Discount</th>
        <SortTh col="event_type_1" label="Event 1" style={{ width: 160 }} {...s} />
        <SortTh col="pay_impact_1" label="Impact 1" style={{ width: 176 }} {...s} />
        <th className={th} style={{ width: 160 }}>Event 2</th>
        <th className={th} style={{ width: 176 }}>Impact 2</th>
        <th className={th} style={{ width: 140 }}>Doc</th>
        <th className={th}>Auto-Notes</th>
        <th className={th}>Notes</th>
      </tr>
    </thead>
  );
}
```

## `src/app/pages/action-required/ArCommitBar.tsx` (whole file)

```tsx
import { Loader2, RotateCcw, Send } from 'lucide-react';
import { BulkBar, BulkPrimaryButton } from '@/app/components/ds/BulkBar';

/**
 * The bulk bar (AR-4: ds/BulkBar, floating, only for 2+ rows) and the
 * "N unsaved · Discard All" button. Same props as before AR-4.
 */
export function ArCommitBar({ someSelected, selectedCount, selectedSize, bulkSaving, dirtyCount, onDeselectAll, onCommit, onDiscardAll }: {
  someSelected: boolean;
  selectedCount: number;
  selectedSize: number;
  bulkSaving: boolean;
  dirtyCount: number;
  onDeselectAll: () => void;
  onCommit: () => void;
  onDiscardAll: () => void;
}) {
  return (
    <>
      <BulkBar count={someSelected ? selectedCount : 0} onClear={onDeselectAll}>
        {selectedSize > 1 && (
          <span className="hidden text-[12px] text-white/70 xl:inline">Event, Impact and Doc changes apply to all {selectedSize}</span>
        )}
        <BulkPrimaryButton onClick={onCommit} disabled={bulkSaving}>
          <span className="inline-flex items-center gap-1.5">
            {bulkSaving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Committing…</>
              : <><Send className="w-3.5 h-3.5" />Commit {selectedCount} to Green</>}
          </span>
        </BulkPrimaryButton>
      </BulkBar>

      {dirtyCount > 0 && (
        <div className="shrink-0 flex items-center gap-2">
          <button type="button" onClick={onDiscardAll}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[12px] font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring">
            <RotateCcw className="w-3.5 h-3.5" />{dirtyCount} Unsaved · Discard All
          </button>
        </div>
      )}
    </>
  );
}
```

## `src/app/pages/ActionRequired.tsx`: four exact replacements, nothing else

1. Replace
   `<div className="flex flex-col h-full p-5 gap-4 overflow-hidden">`
   with
   ``<div className={`flex flex-col h-full p-5 gap-4 overflow-hidden ${bulk ? 'pb-20' : ''}`}>``
2. Inside the table container's className, replace the text
   `flex-1 min-h-0 rounded-lg border shadow-sm overflow-auto transition-opacity`
   with
   `flex-1 min-h-0 rounded-xl border border-slate-200 bg-white shadow-card overflow-auto transition-opacity`
   (keep the rest of that template string, including the `loading ? 'opacity-60 pointer-events-none' : ''` part).
3. Replace
   `<table className="w-full text-xs border-collapse tabular-nums" style={{ minWidth: 1120 }}>`
   with
   `<table className="w-full border-separate border-spacing-0 tabular-nums" style={{ minWidth: 1880 }}>`
4. Replace `colSpan={15}` with `colSpan={17}`.

## Report
- Byte size of the four files (each under 15 KB); the four edits as they now read.
- Confirm no other file changed and `/action-required` renders with no console errors.
