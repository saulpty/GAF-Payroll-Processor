import { ChevronDown, ChevronUp } from 'lucide-react';
import { fmtDate } from '@/app/lib/fmtDate';
import StatusChip from '@/app/components/StatusChip';
import type { ChipTone } from '@/app/components/StatusChip';
import type { EmployeeCase, CaseState } from '@/app/lib/disciplinary';
import { daysBetween } from '@/app/lib/disciplinary';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface DisciplinaryRowData extends EmployeeCase {
  employeeId: number | null;
  displayName: string;    // roster name when matched, else the form's name
  role: string;
  branch: string;
  manager: string;
  active: boolean;        // false when matched employee is inactive
  onRoster: boolean;      // false when name could not be resolved
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Number of columns — kept in sync with COLUMNS in DisciplinaryTable
export const DISCIPLINARY_COL_COUNT = 8;

type LevelInfo = { label: string; tone: ChipTone };

function levelInfo(rank: number, rawLevel: string | null): LevelInfo {
  switch (rank) {
    case 3:  return { label: 'Final Written',    tone: 'red' };
    case 2:  return { label: 'Second Written',   tone: 'amber' };
    case 1:  return { label: 'First Written',    tone: 'amber' };
    case 0:  return { label: 'Verbal',           tone: 'slate' };
    default: return { label: rawLevel ?? '—',    tone: 'slate' };
  }
}

function stateChip(row: DisciplinaryRowData, asOf: string): { label: string; tone: ChipTone } {
  const { worstState, nextReval, actions } = row;
  switch (worstState) {
    case 'overdue': {
      // Find the earliest overdue revaluation date
      const today = asOf.slice(0, 10);
      const overdueRevDates = actions
        .filter(a => !a.closed_at && a.revaluation_date && a.revaluation_date.slice(0, 10) < today)
        .map(a => a.revaluation_date!.slice(0, 10));
      const earliest = overdueRevDates.length > 0
        ? overdueRevDates.reduce((a, b) => (a < b ? a : b))
        : today;
      const days = daysBetween(earliest, today);
      return { label: `review overdue ${days} d`, tone: 'red' };
    }
    case 'outcome': {
      // Use the final_outcome from the newest action that has one
      const withOutcome = actions.find(
        a => !a.closed_at && (a.final_outcome === 'Suspension' || a.final_outcome === 'Termination'),
      );
      return { label: withOutcome?.final_outcome ?? 'Outcome', tone: 'red' };
    }
    case 'open':
      if (nextReval) return { label: `re-eval ${fmtDate(nextReval)}`, tone: 'amber' };
      return { label: 'no re-evaluation set', tone: 'slate' };
    case 'closed':
      return { label: 'all closed', tone: 'green' };
  }
}

// ---------------------------------------------------------------------------
// Escalation dots
// ---------------------------------------------------------------------------

function EscalationDots({ rank }: { rank: number }) {
  const total = 4;
  const filled = rank + 1; // rank 0 = 1 dot, rank 3 = 4 dots, rank -1 = 0 dots
  const tone = rank === 3 ? 'red' : rank >= 1 ? 'amber' : 'slate';
  const filledClass =
    tone === 'red'   ? 'bg-red-500'   :
    tone === 'amber' ? 'bg-amber-400' :
                       'bg-slate-400';
  const levelLabels = ['Verbal', 'First Written', 'Second Written', 'Final Written'];
  const ariaLabel = rank >= 0
    ? `Escalation: ${levelLabels[rank]}, ${filled} of ${total}`
    : 'Escalation: unknown level';

  return (
    <div className="flex items-center gap-0.5" aria-label={ariaLabel}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && (
            <span
              className={`inline-block w-3 h-px mx-0.5 ${i < filled ? filledClass : 'bg-slate-200'}`}
            />
          )}
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full border ${
              i < filled
                ? `${filledClass} border-transparent`
                : 'bg-white border-slate-200'
            }`}
          />
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisciplinaryRow component
// ---------------------------------------------------------------------------

interface Props {
  row: DisciplinaryRowData;
  asOf: string;
  expanded: boolean;
  onToggle: () => void;
}

export default function DisciplinaryRow({ row, asOf, expanded, onToggle }: Props) {
  const { highestRank, latest } = row;
  const lInfo = levelInfo(highestRank, latest.warning_level);
  const sChip = stateChip(row, asOf);

  // The final_outcome chip (from the newest action that has one, if any).
  const outcomeAction = row.actions.find(
    a => a.final_outcome && a.final_outcome !== '' && !a.closed_at,
  );
  const showOutcomeChip =
    outcomeAction &&
    row.worstState !== 'outcome'; // already shown in status when worstState === outcome

  const nameClass = row.active ? 'font-medium text-slate-900' : 'font-medium text-slate-400';

  return (
    <>
      {/* Summary row */}
      <tr
        className="hover:bg-slate-50/80 transition-colors duration-100 cursor-pointer"
        onClick={onToggle}
      >
        {/* Employee */}
        <td className="px-3 py-2.5 min-w-[180px]">
          <div className={nameClass}>{row.displayName}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1 flex-wrap mt-0.5">
            {row.role && <span>{row.role}</span>}
            {row.role && row.branch && <span className="text-slate-300">·</span>}
            {row.branch && <span>{row.branch}</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {!row.onRoster && <StatusChip tone="slate">not on roster</StatusChip>}
            {!row.active && <StatusChip tone="slate">inactive</StatusChip>}
          </div>
        </td>

        {/* Manager (the one who filed the action) */}
        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap max-w-[160px]">
          <div className="truncate">{row.manager || '—'}</div>
        </td>

        {/* Actions count */}
        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
          {row.actions.length}
        </td>

        {/* Highest level */}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 flex-wrap">
            <StatusChip tone={lInfo.tone}>{lInfo.label}</StatusChip>
            {showOutcomeChip && (
              <StatusChip tone="red">{outcomeAction!.final_outcome}</StatusChip>
            )}
          </div>
        </td>

        {/* Escalation dots */}
        <td className="px-3 py-2.5">
          <EscalationDots rank={highestRank} />
        </td>

        {/* Latest */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="text-slate-700 tabular-nums">{fmtDate(latest.document_date)}</div>
          {latest.scenario && (
            <div className="text-xs text-slate-500 truncate max-w-[180px]">{latest.scenario}</div>
          )}
        </td>

        {/* Status */}
        <td className="px-3 py-2.5">
          <StatusChip tone={sChip.tone}>{sChip.label}</StatusChip>
        </td>

        {/* Expand toggle */}
        <td
          className="px-3 py-2.5 text-slate-400 text-center"
          onClick={e => { e.stopPropagation(); onToggle(); }}
        >
          {expanded
            ? <ChevronUp className="w-4 h-4 inline" />
            : <ChevronDown className="w-4 h-4 inline" />}
        </td>
      </tr>

      {/* Detail row — placeholder until next prompt */}
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={DISCIPLINARY_COL_COUNT} className="border-b border-slate-100">
            <div className="px-6 py-4 text-sm text-slate-400">
              Case file — {row.actions.length} action{row.actions.length === 1 ? '' : 's'}.
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
