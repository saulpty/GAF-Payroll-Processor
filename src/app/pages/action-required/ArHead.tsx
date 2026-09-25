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
        <th className={`${th} text-right`} style={{ width: 104 }}>Discount</th>
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
