import { useState } from 'react';
import { Plus, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import PageHeader from '@/app/components/PageHeader';
import PtoTable from './pto/PtoTable';
import RecordApprovalDialog from './pto/RecordApprovalDialog';
import PtoComingUp from './pto/PtoComingUp';
import type { DialogMode } from './pto/RecordApprovalDialog';
import type { PtoRowData } from './pto/PtoRow';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';

export default function PtoTracker() {
  const { bumpPtoVersion } = useGlobalFilters();
  const { isSuper } = useViewer();
  const [asOf, setAsOf] = useState(() => toLocalYMD(new Date()));
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [rows, setRows] = useState<PtoRowData[]>([]);

  const handleExport = () => {
    const wsData = [
      ['Employee', 'Title', 'Start Date', 'Accrued', 'Taken', 'Available', 'Paid PTO', 'FH Left', 'WFH', 'Birthday',
        ...(isSuper ? ['Review'] : [])],
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
        ...(isSuper ? [r.review] : []),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PTO Tracker');
    XLSX.writeFile(wb, `pto-tracker-${asOf}.xlsx`);
  };

  // Warm design system (2026-10-06): the primary action is orange with navy ink;
  // the employee and review counts moved to chips above the table.
  const actions = (
    <>
      <label className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
        As Of
        <input
          type="date"
          value={asOf}
          onChange={e => setAsOf(e.target.value)}
          className="h-8 px-2.5 text-[13px] font-normal text-slate-900 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring"
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={rows.length === 0}
      >
        <Download className="w-3.5 h-3.5 mr-1" />
        Export
      </Button>
      {isSuper && (
        <Button
          size="sm"
          className="bg-warm text-warm-ink hover:bg-warm hover:brightness-95 font-semibold"
          onClick={() => setDialogMode({ kind: 'manual' })}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Manually
        </Button>
      )}
    </>
  );

  const today = toLocalYMD(new Date());

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="PTO Tracker"
        subtitle="Accrual, requests and floating holidays, one row per employee."
        actions={actions}
      />
      <PtoComingUp today={today} refreshKey={refreshKey} />
      <div className="flex-1 min-h-0 flex flex-col">
        <PtoTable
          asOf={asOf}
          today={today}
          refreshKey={refreshKey}
          onOpenDialog={setDialogMode}
          onRowsChange={setRows}
        />
      </div>
      {isSuper && (
        <RecordApprovalDialog
          mode={dialogMode}
          today={today}
          onClose={() => setDialogMode(null)}
          onSaved={() => { setDialogMode(null); setRefreshKey(k => k + 1); bumpPtoVersion(); }}
        />
      )}
    </div>
  );
}
