import { useState, useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import loadPtoBalancesInputsAction from '@/actions/loadPtoBalancesInputs';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { accruedPto } from '@/app/lib/ptoAccrual';
import BalancesRow, { PtoRow } from './BalancesRow';

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function BalancesTab() {
  const [asOf, setAsOf] = useState(todayStr);
  const { employee, role, manager } = useGlobalFilters();

  const year = asOf.slice(0, 4);

  const [rawRows, loading, error, reload] = useLoadAction(
    loadPtoBalancesInputsAction,
    [] as PtoRow[],
    { year, manager: manager || null },
  );

  const allRows = rawRows as PtoRow[];

  // Client-side employee/role filter
  const rows = useMemo(() => {
    let r = allRows;
    if (employee) r = r.filter(x => String(x.employee_id) === employee || x.display_name.toLowerCase().includes(employee.toLowerCase()));
    if (role)     r = r.filter(x => (x.role ?? '').toLowerCase().includes(role.toLowerCase()));
    return r;
  }, [allRows, employee, role]);

  const handleExport = () => {
    const wsData = [
      ['Employee', 'Title', 'Start Date', 'Accumulated PTO', 'Available PTO', 'Taken PTO', 'Paid PTO'],
      ...rows.map(row => {
        const start = row.pto_start_date_override || row.start_date || '';
        const taken = Number(row.taken_days) || 0;
        const accrued = start && start <= asOf ? accruedPto(start, asOf) : null;
        const available = accrued !== null ? accrued - taken : null;
        return [
          row.display_name,
          row.role || '',
          start || '',
          accrued !== null ? +accrued.toFixed(2) : '',
          available !== null ? +available.toFixed(2) : '',
          +taken.toFixed(2),
          Number(row.paid_pto_days) || 0,
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PTO Balances');
    XLSX.writeFile(wb, `pto-balances-${asOf}.xlsx`);
  };

  const noStartCount = rows.filter(r => !(r.pto_start_date_override || r.start_date)).length;

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600 font-medium whitespace-nowrap">As of</label>
          <input
            type="date"
            value={asOf}
            onChange={e => setAsOf(e.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1" />
          Export to Excel
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {loading ? '' : `${rows.length} employee${rows.length !== 1 ? 's' : ''}`}
          {noStartCount > 0 && !loading && (
            <span className="ml-2 text-amber-600">· {noStartCount} without start date</span>
          )}
        </span>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-xl p-4 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold">Failed to load PTO data</p>
            <p className="text-xs mt-1">{String(error)}</p>
            <button onClick={() => reload()} className="mt-2 underline text-xs">Retry</button>
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">No active employees match the filters.</p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Employee</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Start</th>
                <th className="px-3 py-2 text-right font-medium">Accrued</th>
                <th className="px-3 py-2 text-right font-medium">Taken</th>
                <th className="px-3 py-2 text-right font-medium">Available</th>
                <th className="px-3 py-2 text-right font-medium">Paid PTO</th>
                <th className="px-3 py-2 text-right font-medium">FH Left</th>
                <th className="px-3 py-2 text-right font-medium">WFH</th>
                <th className="px-3 py-2 text-right font-medium">Birthday</th>
                <th className="px-3 py-2 text-right font-medium">TFT h</th>
                <th className="px-3 py-2 text-center font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <BalancesRow
                  key={row.employee_id}
                  row={row}
                  asOf={asOf}
                  onSaved={reload}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
