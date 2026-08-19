import { useState, useEffect } from 'react';
import { Loader2, Plus, Pencil, Trash2, Minus } from 'lucide-react';
import { useLoadAction, useMutateAction } from '@uibakery/data';
import { Button } from '@/components/ui/button';
import StatusChip from '@/app/components/StatusChip';
import EmptyState from '@/app/components/EmptyState';
import type { PtoRowData } from './PtoRow';
import type { DialogMode, PendingRequest, LedgerRow } from './RecordApprovalDialog';
import loadPtoEmployeeDetailAction from '@/actions/loadPtoEmployeeDetail';
import upsertFloatingHolidayAction from '@/actions/upsertFloatingHoliday';
import updatePtoApprovalStatusAction from '@/actions/updatePtoApprovalStatus';
import { fhEligibleDate, fhRemaining } from '@/app/lib/ptoAccrual';
import { toLocalYMD } from '@/app/lib/classificationEngine';

interface Props {
  row: PtoRowData;
  year: string;
  showWithdrawn: boolean;
  onOpenDialog: (m: DialogMode) => void;
  onChanged: () => void;
  detailKey: number;
}

interface DetailRow {
  pending: PendingRequest[] | string;
  ledger: LedgerRow[] | string;
  fh: {
    fh_allocated: number; fh_used: number; notes: string | null;
    start_date: string | null; pto_start_date_override: string | null;
  } | null;
}

function ymd(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : '';
}

function parseJSON<T>(v: T | string | null | undefined, fallback: T): T {
  if (!v) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

export default function PtoBreakdown({ row, year, showWithdrawn, onOpenDialog, onChanged, detailKey }: Props) {
  const [rawDetail, loading, error] = useLoadAction(
    loadPtoEmployeeDetailAction,
    null,
    { params: { employee_id: row.employee_id, year, manager: null } },
  );

  // detailKey change forces re-mount via key in parent; we rely on re-render to reload
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _key = detailKey;

  const detailArr = (rawDetail as DetailRow[] | null);
  const detail: DetailRow | null = Array.isArray(detailArr) ? (detailArr[0] ?? null) : (rawDetail as DetailRow | null);

  const pending: PendingRequest[] = parseJSON(detail?.pending, []);
  const ledger: LedgerRow[] = parseJSON(detail?.ledger, []);

  // FH block state
  const rawFh = detail?.fh ?? null;
  const [fhUsed, setFhUsed] = useState<number | null>(null);
  const [fhSaveErr, setFhSaveErr] = useState(false);
  const [upsertFH] = useMutateAction(upsertFloatingHolidayAction);
  const [withdraw] = useMutateAction(updatePtoApprovalStatusAction);

  // Sync local fhUsed when detail loads
  useEffect(() => {
    if (rawFh !== null) setFhUsed(Number(rawFh.fh_used) || 0);
  }, [rawFh, detailKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-12">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="px-6 py-2 text-[12px] text-red-600">
        Couldn&apos;t load details — loadPtoEmployeeDetail
      </div>
    );
  }

  const fhAllocated = Number(rawFh?.fh_allocated ?? 2);
  const usedDisplay = fhUsed ?? Number(rawFh?.fh_used ?? 0);
  const fhStart = ymd(rawFh?.pto_start_date_override ?? rawFh?.start_date);
  const today = toLocalYMD(new Date());
  const fhEligFrom = fhStart ? fhEligibleDate(fhStart) : null;
  const fhNotEligYet = fhEligFrom ? fhEligFrom > today : false;

  const takenSum = ledger
    .filter(e => e.status === 'recorded')
    .reduce((s, e) => s + (Number(e.total_days) || 0), 0);

  const handleFhStep = async (delta: number) => {
    const next = usedDisplay + delta;
    if (next < 0 || next > fhAllocated) return;
    setFhSaveErr(false);
    setFhUsed(next);
    try {
      await upsertFH({
        employee_id: row.employee_id,
        calendar_year: Number(year),
        fh_allocated: fhAllocated,
        fh_used: next,
        notes: rawFh?.notes ?? null,
      });
      onChanged();
    } catch {
      setFhSaveErr(true);
      setFhUsed(usedDisplay - delta); // rollback
    }
  };

  const handleWithdraw = async (entry: LedgerRow) => {
    const ok = window.confirm(
      `Withdraw this PTO record? Taken will drop by ${entry.total_days} days.`
    );
    if (!ok) return;
    await withdraw({ id: entry.id, status: 'withdrawn' });
    onChanged();
  };

  const sourceChip = (src: string) => {
    if (src === 'monday')       return <StatusChip tone="violet">Monday</StatusChip>;
    if (src === 'excel_import') return <StatusChip tone="slate">Excel</StatusChip>;
    if (src === 'manual')       return <StatusChip tone="blue">Manual</StatusChip>;
    return <StatusChip tone="slate">{src}</StatusChip>;
  };

  const visibleLedger = showWithdrawn
    ? ledger
    : ledger.filter(e => e.status !== 'withdrawn');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] gap-4 px-6 py-4">

      {/* Block 1 — Pending from Monday */}
      <div className="rounded-lg border border-slate-200 shadow-card p-3 bg-white">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Pending from Monday
        </div>
        {pending.length === 0 ? (
          <EmptyState title="Nothing waiting" compact />
        ) : (
          <ul className="space-y-2">
            {pending.map((req, i) => (
              <li key={req.monday_item_id ?? i} className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] text-slate-800">
                    {ymd(req.leave_on)} → {ymd(req.return_on)}
                    <span className="text-slate-400 ml-1">· requested {req.total_days} d</span>
                  </div>
                  {req.reason && (
                    <div className="text-[12px] text-slate-500 truncate" title={req.reason}>
                      {req.reason}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => onOpenDialog({ kind: 'record', request: req })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Record
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Block 2 — Recorded PTO */}
      <div className="rounded-lg border border-slate-200 shadow-card p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Recorded PTO
          </div>
          <div className="text-[12px] text-slate-500">
            taken {takenSum.toFixed(2)} d
          </div>
        </div>
        {visibleLedger.length === 0 ? (
          <EmptyState title="No PTO recorded" compact />
        ) : (
          <ul className="space-y-2">
            {visibleLedger.map(entry => {
              const withdrawn = entry.status === 'withdrawn';
              return (
                <li key={entry.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] flex flex-wrap items-center gap-1 ${withdrawn ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      <span>{ymd(entry.leave_on)} → {ymd(entry.return_on)} · {entry.total_days} d</span>
                      {sourceChip(entry.source)}
                      {withdrawn && <StatusChip tone="red" strike>withdrawn</StatusChip>}
                    </div>
                    {entry.gaf_comments && (
                      <div className="text-[12px] text-slate-500 truncate" title={entry.gaf_comments}>
                        {entry.gaf_comments}
                      </div>
                    )}
                  </div>
                  {!withdrawn && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onOpenDialog({ kind: 'edit', row: entry })}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      {entry.status === 'recorded' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                          onClick={() => handleWithdraw(entry)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Withdraw
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Block 3 — Floating holidays */}
      <div className="rounded-lg border border-slate-200 shadow-card p-3 bg-white">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Floating holidays {year}
        </div>
        {fhNotEligYet ? (
          <div className="text-[12px] text-slate-500">
            Eligible from {fhEligFrom}
          </div>
        ) : (
          <div>
            <div className="text-[18px] font-semibold text-slate-900">
              {usedDisplay} of {fhAllocated} used
            </div>
            <div className="text-[12px] text-slate-500 mb-3">
              {fhRemaining(fhAllocated, usedDisplay)} left
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={usedDisplay <= 0}
                aria-label="Decrease floating holidays used"
                onClick={() => handleFhStep(-1)}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={usedDisplay >= fhAllocated}
                aria-label="Increase floating holidays used"
                onClick={() => handleFhStep(1)}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {fhSaveErr && (
              <div className="text-[12px] text-red-600 mt-1">Couldn&apos;t save — try again</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
