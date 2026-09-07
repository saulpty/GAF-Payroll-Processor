import { useState } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import PageHeader from '@/app/components/PageHeader';
import DisciplinaryTable from './disciplinary/DisciplinaryTable';
import type { DisciplinaryRowData } from './disciplinary/DisciplinaryRow';
import { caseState } from '@/app/lib/disciplinary';
import type { DisciplinaryRow as DisciplinaryRowType } from '@/app/lib/disciplinary';
import { fmtDate } from '@/app/lib/fmtDate';
import { toLocalYMD } from '@/app/lib/classificationEngine';

type StatusFilter = 'all' | 'open' | 'overdue' | 'closed';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'open',    label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'closed',  label: 'Closed' },
];

function activeClass(value: StatusFilter, active: StatusFilter): string {
  if (value !== active) {
    return 'bg-white text-slate-600 border-border hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700';
  }
  if (value === 'overdue') return 'bg-red-600 text-white border-red-600 shadow-sm';
  if (value === 'open')    return 'bg-amber-500 text-white border-amber-500 shadow-sm';
  if (value === 'closed')  return 'bg-emerald-600 text-white border-emerald-600 shadow-sm';
  return 'bg-slate-600 text-white border-slate-600 shadow-sm'; // all
}

function stateWord(s: ReturnType<typeof caseState>): string {
  if (s === 'closed')  return 'Closed';
  if (s === 'outcome') return 'Outcome';
  if (s === 'overdue') return 'Overdue';
  return 'Open';
}

export default function Disciplinary() {
  const [asOf] = useState(() => toLocalYMD(new Date()));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [rows, setRows] = useState<DisciplinaryRowData[]>([]);
  const [counts, setCounts] = useState<{ employees: number; actions: number; open: number } | null>(null);

  const handleExport = () => {
    const header = [
      'Employee', 'Role', 'Branch', 'Manager', 'Date', 'Level', 'Outcome',
      'Scenario', 'Re-evaluation', 'Status', 'Closed on', 'Closed by', 'Ref',
    ];

    const data: (string | number)[][] = [];
    for (const row of rows) {
      for (const action of (row.actions as DisciplinaryRowType[])) {
        const state = caseState(action, asOf);
        data.push([
          row.displayName,
          row.role ?? '',
          row.branch ?? '',
          action.manager_name ?? '',
          fmtDate(action.document_date) ?? '',
          action.warning_level ?? '',
          action.final_outcome ?? '',
          action.scenario ?? '',
          fmtDate(action.revaluation_date) ?? '',
          stateWord(state),
          fmtDate(action.closed_at) ?? '',
          action.closed_by ?? '',
          action.ref,
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Disciplinary');
    XLSX.writeFile(wb, `disciplinary-${asOf}.xlsx`);
  };

  const countSummary = counts !== null ? (() => {
    const emp = counts.employees;
    const act = counts.actions;
    const opn = counts.open;
    const empPart = `${emp} ${emp === 1 ? 'employee' : 'employees'}`;
    const actPart = ` · ${act} ${act === 1 ? 'action' : 'actions'}`;
    const opnPart = opn > 0 ? ` · ${opn} open` : '';
    return `${empPart}${actPart}${opnPart}`;
  })() : null;

  const actions = (
    <>
      {countSummary !== null && (
        <span className="text-[12px] text-slate-400 mr-1">{countSummary}</span>
      )}

      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Filter by case status"
      >
        {STATUS_OPTIONS.map(opt => {
          const isActive = statusFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => setStatusFilter(isActive ? 'all' : opt.value)}
              className={[
                'h-8 px-3 rounded-lg text-xs font-semibold border transition-colors select-none focus-visible:ring-2 focus-visible:ring-primary/30 focus:outline-none',
                activeClass(opt.value, statusFilter),
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={rows.length === 0}
        className="focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <Download className="w-3.5 h-3.5 mr-1" />
        Export
      </Button>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Disciplinary actions"
        subtitle="One row per employee with a record. Expand a row to read the file."
        actions={actions}
      />
      <div className="flex-1 min-h-0 flex flex-col">
        <DisciplinaryTable
          asOf={asOf}
          statusFilter={statusFilter}
          onRowsChange={setRows}
          onCountsChange={setCounts}
        />
      </div>
    </div>
  );
}
