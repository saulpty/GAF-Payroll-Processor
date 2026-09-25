import { CheckSquare, Edit2, Square } from 'lucide-react';
import { Th } from './ArBits';
import type { SortDir, SortKey } from './arTypes';

const editTh = 'px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r bg-blue-50 text-blue-700 w-24';
const plainTh = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap border-r';

/** The work table's header row. Split out of ActionRequired.tsx, AR-1. */
export function ArHead({ allFilteredSelected, someSelected, showPeriod, sortKey, sortDir, onSort, onToggleAll }: {
  allFilteredSelected: boolean;
  someSelected: boolean;
  showPeriod: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (col: SortKey) => void;
  onToggleAll: () => void;
}) {
  const sortProps = { sortKey, sortDir, onSort };
  return (
    <thead className="sticky top-0 z-20">
      <tr className="bg-slate-100 border-b-2 border-slate-300">
        {/* Checkbox select-all */}
        <th className="px-2 py-2.5 w-8 border-r sticky left-0 bg-slate-100 z-30">
          <button onClick={onToggleAll} className="flex items-center justify-center w-full">
            {allFilteredSelected
              ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              : someSelected
                ? <span className="w-3.5 h-3.5 rounded-sm border-2 border-blue-400 bg-blue-100 block" />
                : <Square className="w-3.5 h-3.5 text-slate-400" />}
          </button>
        </th>
        <Th col="employee_name" label="Employee" className="sticky left-8 bg-slate-100 z-30 min-w-36" {...sortProps} />
        {showPeriod && <Th col="period_name" label="Period" {...sortProps} />}
        <Th col="work_date" label="Date" {...sortProps} />
        <th className={editTh} style={{ width: 112, minWidth: 112 }}><Edit2 className="w-3 h-3 inline mr-1" />Entry</th>
        <th className={editTh} style={{ width: 112, minWidth: 112 }}><Edit2 className="w-3 h-3 inline mr-1" />Exit</th>
        <th className={`${plainTh} text-slate-500`}>Sched</th>
        <Th col="late_minutes" label="Late min" {...sortProps} />
        <Th col="early_leave_minutes" label="Early min" {...sortProps} />
        <th className={plainTh}>Event 1</th>
        <th className={plainTh}>Impact 1</th>
        <th className={plainTh}>Event 2</th>
        <th className={plainTh}>Impact 2</th>
        <th className={plainTh}>Doc</th>
        <th className={plainTh}>Auto-Notes</th>
        <th className={plainTh}>Notes</th>
      </tr>
    </thead>
  );
}
