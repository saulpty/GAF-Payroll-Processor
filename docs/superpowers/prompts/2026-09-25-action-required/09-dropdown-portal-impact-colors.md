# AR-9: dropdown list no longer hidden behind cells; pay impacts in colour

**Copy every code block exactly, character for character. Do not rewrite, merge, "improve" or re-derive any of it from the description. If your context is compacted mid-task, re-read this prompt before writing any file.**

**Only these four files may change** (replace each whole file):
1. `src/app/components/ds/Combobox.tsx`
2. `src/app/pages/action-required/arLogic.ts`
3. `src/app/pages/action-required/ArRow.tsx`
4. `src/app/pages/action-required/ArCommitted.tsx`

No other file may be touched. Pay rules are unchanged (the colours are display-only).

## Why (Tim and Saul, after 8.15.0)
- **"The drop-down is kinda broken: when you open it, it gets hidden behind cells."** The open
  list was drawn inside the table cell, so it was clipped by the table's scroll box and painted
  under the frozen columns and later rows. It is now rendered through a React portal into
  `<body>` with fixed positioning, right under its field (or above it when there is no room
  below), and it closes if the page or the table scrolls. The Combobox's props are unchanged
  apart from a new optional `toneOf`, so the Event filter keeps working as is.
- **"Pay impacts should be in different colours."** A dot next to each impact, in the dropdown
  and in the Committed list, mirroring the pay math (only the Unpaid impacts deduct):
  green = no deduction (Paid, Incapacidad, PTO…), amber = Unpaid (with Grace) (deducts only
  past the grace), red = Unpaid / Unpaid (without Grace).

## `src/app/components/ds/Combobox.tsx` (whole file)

```tsx
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import { filterOptions, nextIndex } from '@/app/components/ds/comboboxFilter';

// Dropdowns rule (docs/uib/DESIGN.md): searchable when > 7 options, empty
// shows "—", a × clears back to empty, no "None" / "— pick —" option.
// The open list is portalled to <body> with fixed positioning (AR-9): inside a
// scrolling table it was clipped and hidden behind other cells. It opens upward
// when there is no room below, and closes when the page or table scrolls.
export function Combobox({
  value,
  options,
  onChange,
  placeholder = '—',
  ariaLabel,
  invalid = false,
  flashKey,
  className = '',
  toneOf,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  invalid?: boolean;
  flashKey?: number;
  className?: string;
  /** Optional colour dot per option (a Tailwind bg class), e.g. green for paid impacts. */
  toneOf?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const searchable = options.length > 7;

  const filtered = useMemo(
    () => (searchable && open ? filterOptions(options, query) : options),
    [options, query, searchable, open],
  );

  // Place the list under the field (or above it when the space below is short).
  useLayoutEffect(() => {
    if (!open || !fieldRef.current) return;
    const r = fieldRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < 240 && above > below;
    const room = Math.max(120, Math.min(280, up ? above : below));
    setPos({
      position: 'fixed', left: r.left, width: Math.max(r.width, 180), zIndex: 60, maxHeight: room,
      ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      !!t && ((rootRef.current?.contains(t as Node) ?? false) || (popRef.current?.contains(t as Node) ?? false));
    const onDocPointer = (e: MouseEvent) => { if (!inside(e.target)) setOpen(false); };
    const onScroll = (e: Event) => { if (!inside(e.target)) setOpen(false); };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    setQuery('');
    setActiveIdx(options.findIndex(o => o === value));
    if (searchable) requestAnimationFrame(() => inputRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commit(v: string) {
    onChange(v);
    setOpen(false);
    fieldRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      fieldRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => nextIndex(i, 1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => nextIndex(i, -1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < filtered.length) commit(filtered[activeIdx]);
    }
  }

  const activeId = activeIdx >= 0 && activeIdx < filtered.length ? `${listId}-opt-${activeIdx}` : undefined;
  const dot = (v: string) => (toneOf && v ? <span className={`h-2 w-2 shrink-0 rounded-full ${toneOf(v)}`} aria-hidden="true" /> : null);

  // flashKey > 0 and changed → remount the field so the red pulse replays.
  const flashing = (flashKey ?? 0) > 0;

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        ref={fieldRef}
        key={flashing ? flashKey : 'field'}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        className={`flex h-7 w-full items-center justify-between gap-1 rounded-md border bg-white pl-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${
          value ? 'pr-9' : 'pr-2'
        } ${invalid ? 'border-red-500' : 'border-slate-300'} ${value ? 'text-slate-700' : 'text-slate-400'} ${
          flashing ? 'animate-flash-required' : ''
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">{dot(value)}<span className="truncate">{value || placeholder}</span></span>
        {!value && <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />}
      </button>
      {value && (
        <span className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          <button
            type="button"
            aria-label={`Clear ${ariaLabel}`}
            onClick={() => onChange('')}
            className="rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
          <ChevronDown className="pointer-events-none h-3 w-3 text-slate-400" aria-hidden="true" />
        </span>
      )}
      {open && pos && createPortal(
        <div ref={popRef} style={pos} className="flex flex-col rounded-md border border-slate-200 bg-white shadow-lg">
          {searchable && (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search"
              aria-label={`Search ${ariaLabel}`}
              className="w-full shrink-0 border-b border-slate-200 px-2 py-1 text-[12px] focus:outline-none"
            />
          )}
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="min-h-0 flex-1 overflow-auto py-1">
            {filtered.length === 0 && <li className="px-2 py-1 text-[12px] text-slate-400">No matches</li>}
            {filtered.map((opt, i) => (
              <li
                id={`${listId}-opt-${i}`}
                key={opt}
                role="option"
                aria-selected={opt === value}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => commit(opt)}
                className={`flex cursor-pointer items-center gap-1.5 px-2 py-1 text-[12px] ${
                  i === activeIdx ? 'bg-warm-tint text-slate-900' : 'text-slate-700'
                } ${opt === value ? 'font-medium' : ''}`}
              >
                {dot(opt)}{opt}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
```

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

/**
 * Pay impact colour (AR-9), mirroring computeDiscount: only the Unpaid impacts deduct.
 * 'unpaid' = Unpaid / Unpaid (without Grace); 'partial' = Unpaid (with Grace), which
 * deducts only past the grace; 'paid' = every other impact; 'none' = blank.
 */
export function impactTone(impact: string | null | undefined): 'paid' | 'partial' | 'unpaid' | 'none' {
  const v = (impact ?? '').trim();
  if (!v) return 'none';
  if (v === 'Unpaid' || v === 'Unpaid (without Grace)') return 'unpaid';
  if (v === 'Unpaid (with Grace)') return 'partial';
  return 'paid';
}

/** Dot colour class per impact tone (Excel status inks). */
export const IMPACT_DOT: Record<string, string> = {
  paid: 'bg-status-green-ink', partial: 'bg-status-yellow-ink', unpaid: 'bg-status-red-ink', none: '',
};

/** Ids between two visible indexes, inclusive, in visible order (shift-click range). */
export function rangeIds(visible: { id: number }[], a: number, b: number): number[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return visible.slice(lo, hi + 1).map(r => r.id);
}
```

## `src/app/pages/action-required/ArRow.tsx` (whole file)

```tsx
import { Check, Send } from 'lucide-react';
import { TimeInput } from '@/app/components/TimeInput';
import { Combobox } from '@/app/components/ds/Combobox';
import { computePunchMinutes } from '@/app/lib/punchMinutes';
import { computeDiscount, toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDay } from '@/app/lib/fmtDay';
import { fmtShift } from '@/app/lib/fmtTime';
import { discountLabel, fmtMinutes, IMPACT_DOT, impactTone, missingEvent } from './arLogic';
import type { EditState, EntryRow } from './arTypes';

const THIS_YEAR = toLocalYMD(new Date()).slice(0, 4);
const td = 'px-2 py-1.5 border-b border-slate-100';
const impactDot = (v: string) => IMPACT_DOT[impactTone(v)];
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
  // Always recompute from the punches, exactly as the save does (stored minutes can be stale).
  const live = computePunchMinutes({
    entry_time: edit.entry_time, exit_time: edit.exit_time,
    scheduled_start: row.scheduled_start, scheduled_end: row.scheduled_end, grace_until: row.grace_until,
  });
  const late = live ? live.late_minutes : row.late_minutes;
  const early = live ? live.early_leave_minutes : row.early_leave_minutes;
  // What a commit would deduct right now: the same computeDiscount the save uses.
  const discount = discountLabel(computeDiscount({
    event_type_1: edit.event_type_1, pay_impact_1: edit.pay_impact_1,
    event_type_2: edit.event_type_2, pay_impact_2: edit.pay_impact_2,
    late_minutes: late, late_after_grace: live ? live.late_after_grace : row.late_after_grace,
    early_leave_minutes: early,
  // "Paid" only once every chosen event also has its impact (the pay decision is made).
  }), !!(edit.event_type_1 || edit.event_type_2) && (!edit.event_type_1 || !!edit.pay_impact_1) && (!edit.event_type_2 || !!edit.pay_impact_2));
  const broadcasting = isSelected && selectedSize > 1;
  const tint = isSelected ? 'bg-warm-tint' : row.initial_status === 'RED' ? 'bg-status-red-tint' : 'bg-status-yellow-tint';
  const bar = isSelected ? 'shadow-[inset_3px_0_0_var(--warm)]' : '';
  const pick = (field: keyof EditState) => (v: string) => onEdit(row.id, field, v, row, visibleRows);
  const combo = (field: keyof EditState, value: string, options: string[], label: string, invalid = false, toneOf?: (v: string) => string) => (
    <div className={broadcasting ? 'rounded-md ring-1 ring-warm-ring' : ''} title={broadcasting ? `Applies to all ${selectedSize} selected rows` : undefined}>
      <Combobox value={value} options={options} onChange={pick(field)} ariaLabel={`${label}, ${row.employee_name} ${row.work_date.slice(0, 10)}`}
        invalid={invalid} flashKey={invalid ? 1 : 0} className="w-full" toneOf={toneOf} />
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
      <td className={`${td} text-right`} style={{ width: 104 }}>
        {discount.tone === 'deduct' && <span className="inline-block whitespace-nowrap rounded-full bg-status-red-tint px-2 py-0.5 text-[12px] font-semibold tabular-nums text-status-red-ink ring-1 ring-status-red-fill">{discount.text}</span>}
        {discount.tone === 'paid' && <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-status-green-fill px-2 py-0.5 text-[12px] font-semibold text-status-green-ink"><Check className="w-3 h-3" />Paid</span>}
        {discount.tone === 'none' && <span className="text-slate-300">—</span>}
      </td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_1', edit.event_type_1, eventOpts, 'Event 1', needsEvent === 1)}
        {needsEvent === 1 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_1', edit.pay_impact_1, impactOptions, 'Impact 1', false, impactDot)}</td>
      <td className={td} style={{ width: 160, minWidth: 160 }}>
        {combo('event_type_2', edit.event_type_2, eventOpts, 'Event 2', needsEvent === 2)}
        {needsEvent === 2 && <div className="mt-0.5 text-[11px] font-medium text-red-700">Pick an event first</div>}
      </td>
      <td className={td} style={{ width: 176, minWidth: 176 }}>{combo('pay_impact_2', edit.pay_impact_2, impactOptions, 'Impact 2', false, impactDot)}</td>
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

## `src/app/pages/action-required/ArCommitted.tsx` (whole file)

```tsx
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
                {committed.map(r => {
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
          </div>
        )
      )}
    </div>
  );
}
```

## Report
- Byte size of the four files; confirm no other file changed and `/action-required` renders
  with no console errors.
