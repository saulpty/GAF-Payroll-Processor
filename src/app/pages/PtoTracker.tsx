import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import PageHeader from '@/app/components/PageHeader';
import PtoTable from './pto/PtoTable';
import RecordApprovalDialog from './pto/RecordApprovalDialog';
import type { DialogMode } from './pto/RecordApprovalDialog';
import type { PtoRowData } from './pto/PtoRow';
import { toLocalYMD } from '@/app/lib/classificationEngine';

export default function PtoTracker() {
  const [asOf, setAsOf] = useState(() => toLocalYMD(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [rows, setRows] = useState<PtoRowData[]>([]);
  const [counts, setCounts] = useState<{ employees: number; pending: number } | null>(null);

  const handleExport = () => {
    const wsData = [
      ['Employee', 'Title', 'Start', 'Accrued', 'Taken', 'Available', 'Paid PTO', 'FH left', 'WFH', 'Birthday', 'Pending'],
      ...rows.map(r => [
        r.display_name,
        r.role ?? '',
        r.start ?? '',
        r.accrued !== null ? +r.accrued.toFixed(2) : '',
        +(Number(r.taken_days) || 0).toFixed(2),
        r.available !== null ? +r.available.toFixed(2) : '',
        Number(r.paid_pto_days) || 0,
        r.fh_left !== null ? r.fh_left : '',
        Number(r.wfh_days) || 0,
        Number(r.birthday_days) || 0,
        r.pending,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PTO Tracker');
    XLSX.writeFile(wb, `pto-tracker-${asOf}.xlsx`);
  };

  const actions = (
    <>
      {counts !== null && (
        <span className="text-[12px] text-slate-400 mr-1">
          {counts.employees} {counts.employees === 1 ? 'employee' : 'employees'} · {counts.pending} {counts.pending === 1 ? 'request' : 'requests'} to record
        </span>
      )}
      <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        As of
        <input
          type="date"
          value={asOf}
          onChange={e => setAsOf(e.target.value)}
          className="h-8 px-2.5 text-[13px] font-normal normal-case tracking-normal border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDialogMode({ kind: 'manual' })}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add manually
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={rows.length === 0}
      >
        <Download className="w-3.5 h-3.5 mr-1" />
        Export
      </Button>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="PTO Tracker"
        subtitle="Accrual, approvals and floating holidays — one row per employee"
        actions={actions}
      />
      <div className="flex-1 min-h-0 flex flex-col">
        <PtoTable
          asOf={asOf}
          refreshKey={refreshKey}
          onOpenDialog={setDialogMode}
          onRowsChange={setRows}
          onCountsChange={setCounts}
        />
      </div>
      <RecordApprovalDialog
        mode={dialogMode}
        onClose={() => setDialogMode(null)}
        onSaved={() => { setDialogMode(null); setRefreshKey(k => k + 1); }}
      />
    </div>
  );
}
