// Phone view of the Disciplinary list: one row per employee, from the same grouped, sorted and
// filtered list DisciplinaryTable gives its table. Prop-driven: no loader, no query.
// What an action is about is deliberately NOT shown here (it must not be readable over someone's
// shoulder). It is inside the case file, which opens as a sheet.
import { useEffect, useRef } from 'react';
import StatusChip from '@/app/components/StatusChip';
import MobileRow from '@/app/components/mobile/MobileRow';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { levelInfo, stateChip } from './DisciplinaryRow';
import type { DisciplinaryRowData } from './DisciplinaryRow';
import CaseFileSheet from './CaseFileSheet';

type StatusFilter = 'all' | 'open' | 'overdue' | 'closed' | 'deleted';

interface Props {
  /** Exactly the list the table would render: same employees, same order. */
  rows: DisciplinaryRowData[];
  asOf: string;
  statusFilter: StatusFilter;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** employeeName of the open case file, or null. The state lives in DisciplinaryTable. */
  openName: string | null;
  onOpen: (name: string | null) => void;
  onChanged: () => void;
}

const STATUS_WORD: Record<StatusFilter, string> = {
  all: 'All', open: 'Open', overdue: 'Overdue', closed: 'Closed', deleted: 'Deleted',
};

/** The nothing-found line names whatever is filtering the list. */
function nothingFound(statusFilter: StatusFilter, employee: string, role: string, manager: string): string {
  const parts: string[] = [];
  if (statusFilter !== 'all') parts.push(`Status: ${STATUS_WORD[statusFilter]}`);
  if (employee) parts.push(`Employee: ${employee}`);
  if (role) parts.push(`Title: ${role}`);
  if (manager) parts.push(`Manager: ${manager}`);
  return parts.length > 0 ? `No employees match ${parts.join(' · ')}` : 'No disciplinary actions on file.';
}

export default function DisciplinaryRows({
  rows, asOf, statusFilter, loading, failed, onRetry, openName, onOpen, onChanged,
}: Props) {
  const { employee, role, manager } = useGlobalFilters();

  // The open case file. While the list reloads (after Close Case, Reopen, Delete or an edit) the
  // sheet keeps the file it was showing instead of closing and opening again.
  const found = openName === null ? null : rows.find(r => r.employeeName === openName) ?? null;
  const last = useRef<DisciplinaryRowData | null>(null);
  if (found) last.current = found;
  const kept = last.current !== null && last.current.employeeName === openName;
  const sheetOpen = found !== null || (loading && kept);

  // The employee left the list (a filter changed, or the reload no longer returns them): forget
  // them, so the sheet does not come back by itself later.
  useEffect(() => {
    if (openName !== null && !loading && found === null) onOpen(null);
  }, [openName, loading, found, onOpen]);

  if (failed) {
    return (
      <div className="mx-4 mb-4 shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
        <p>Couldn&apos;t load disciplinary actions — loadDisciplinaryActions</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 h-11 w-full rounded-md border border-red-300 bg-white text-[14px] font-semibold text-red-700 active:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {rows.length > 0 ? (
        <div className="shrink-0 bg-white border-t border-slate-200">
          {rows.map(row => {
            const level = levelInfo(row.highestRank, row.latest.warning_level);
            const status = stateChip(row, asOf);
            // Same rule as the table: the outcome chip is left out when the Status chip already says it.
            const outcome = row.worstState === 'outcome'
              ? undefined
              : row.actions.find(a => a.final_outcome && a.final_outcome !== '' && !a.closed_at);
            const count = row.actions.length;
            return (
              <MobileRow
                key={row.employeeName}
                title={
                  <>
                    {row.displayName}
                    {!row.onRoster && <>{' '}<StatusChip tone="slate">Not on Roster</StatusChip></>}
                    {!row.active && <>{' '}<StatusChip tone="slate">Inactive</StatusChip></>}
                  </>
                }
                sub={[row.role, row.branch].filter(Boolean).join(' · ') || undefined}
                right={<StatusChip tone={status.tone}>{status.label}</StatusChip>}
                facts={
                  <>
                    <StatusChip tone={level.tone}>{level.label}</StatusChip>
                    {outcome && <StatusChip tone="red">{outcome.final_outcome}</StatusChip>}
                    <span>{count} {count === 1 ? 'action' : 'actions'}</span>
                  </>
                }
                muted={!row.active}
                chevron="right"
                onClick={() => onOpen(row.employeeName)}
              />
            );
          })}
        </div>
      ) : loading ? (
        <div className="shrink-0 bg-white border-t border-slate-200" role="status" aria-label="Loading">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse px-4 py-3">
              <div className="h-3.5 w-40 rounded bg-slate-200" />
              <div className="mt-2.5 h-3 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-[13px] text-slate-500">
          {nothingFound(statusFilter, employee, role, manager)}
        </p>
      )}
      <CaseFileSheet
        open={sheetOpen}
        row={found ?? last.current}
        asOf={asOf}
        onClose={() => onOpen(null)}
        onChanged={onChanged}
      />
    </>
  );
}
