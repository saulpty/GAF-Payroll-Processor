import { useState } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PageHeader from '@/app/components/PageHeader';
import ContractsTable from './contracts/ContractsTable';
import type { ContractRowData } from './contracts/ContractRow';
import { toLocalYMD } from '@/app/lib/classificationEngine';

const DUE_OPTIONS = [30, 60, 90] as const;

export default function Contracts() {
  const [asOf] = useState(() => toLocalYMD(new Date()));
  const [dueWithin, setDueWithin] = useState<30 | 60 | 90 | null>(null);
  const [rows, setRows] = useState<ContractRowData[]>([]);
  const [counts, setCounts] = useState<{ employees: number; expiring: number; offBoard: number } | null>(null);

  const handleExport = () => {
    const header = ['Employee', 'Position', 'State', 'Start', 'Tenure', '1m', '3m', '6m', '1y', '2y', 'Contract end', 'Status', 'Days until'];
    const data = rows.map(r => {
      const status =
        r.endState.kind === 'ended'  ? 'Renewed' :
        r.endState.kind === 'future' ? `Ending in ${r.endState.days ?? 0} days` :
        '';
      return [
        r.display_name,
        r.position ?? '',
        r.state ?? '',
        r.start ?? '',
        r.tenure ?? '',
        r.ms?.[0]?.date ?? '',
        r.ms?.[1]?.date ?? '',
        r.ms?.[2]?.date ?? '',
        r.ms?.[3]?.date ?? '',
        r.ms?.[4]?.date ?? '',
        r.end ?? '',
        status,
        r.endState.kind !== 'none' ? (r.endState.days ?? '') : '',
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contracts');
    XLSX.writeFile(wb, `contracts-${asOf}.xlsx`);
  };

  const countSummary = counts !== null ? (() => {
    const empPart = `${counts.employees} ${counts.employees === 1 ? 'employee' : 'employees'}`;
    const expPart = counts.expiring > 0
      ? ` · ${counts.expiring} ${counts.expiring === 1 ? 'ending' : 'ending'} within 30 days`
      : '';
    return `${empPart}${expPart}`;
  })() : null;

  const actions = (
    <>
      {countSummary !== null && (
        <span className="text-[12px] text-slate-400 mr-1">{countSummary}</span>
      )}

      {/* Due-within toggle */}
      <div
        className="flex items-center gap-1"
        aria-label="Show only upcoming"
        role="group"
      >
        {DUE_OPTIONS.map(days => {
          const isActive = dueWithin === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => setDueWithin(isActive ? null : days)}
              aria-pressed={isActive}
              className={[
                'h-8 px-3 rounded-lg text-xs font-semibold border transition-colors select-none focus-visible:ring-2 focus-visible:ring-primary/30 focus:outline-none',
                isActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-600 border-border hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700',
              ].join(' ')}
            >
              {days}d
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
        title="Contracts"
        subtitle="Tenure milestones and contract end dates — one row per employee"
        actions={actions}
      />

      {/* Off-board notice — only when count > 0 */}
      {counts && counts.offBoard > 0 && (
        <div className="mx-6 mt-0 mb-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-[12px] text-amber-700 flex items-center gap-1">
          <span>
            {counts.offBoard} {counts.offBoard === 1 ? 'employee is' : 'employees are'} not on the Onboarding board — fix in Admin →{' '}
          </span>
          <Link
            to="/admin/employees?tab=monday"
            className="underline underline-offset-2 hover:text-amber-900 focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
          >
            Employees → Monday
          </Link>
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <ContractsTable
          asOf={asOf}
          dueWithin={dueWithin}
          onRowsChange={setRows}
          onCountsChange={setCounts}
        />
      </div>
    </div>
  );
}
