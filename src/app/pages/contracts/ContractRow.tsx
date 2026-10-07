import { fmtDay } from '@/app/lib/fmtDay';
import { tenureDisplay } from '@/app/lib/contractChips';
import StatusChip from '@/app/components/StatusChip';
import type { RenewalState } from '@/app/lib/tenure';
import { MilestoneCells, ContractEndCell } from './ContractCells';

export interface ContractRowData {
  employee_id: number;
  display_name: string;
  role: string | null;
  manager: string | null;
  roster_start: string | null;
  board_start: string | null;
  position: string | null;
  state: string | null;
  contract_end: string | null;
  has_board_row: boolean;
  // derived
  start: string | null;
  end: string | null;
  ms: { key: string; date: string }[] | null;
  next: { key: string; date: string; days: number } | null;
  tenure: string | null;
  endState: { kind: 'none' | 'ended' | 'future'; days: number | null };
  startMismatch: boolean;
  renewal: RenewalState;
}

interface Props { row: ContractRowData; thisYear: string }

const muted = <span className="text-slate-300">—</span>;

// Warm redesign (2026-10-07): position under the name, weekday dates (fmtDay),
// tenure as "11 mo" / "New", Excel status colours in ContractCells.
export default function ContractRow({ row, thisYear }: Props) {
  const { start, tenure, startMismatch } = row;
  const position = row.has_board_row ? row.position : null;

  // ── Employee cell: name, then position ─────────────────────────────────
  const nameCell = (
    <div>
      <div className="font-medium text-slate-900 whitespace-nowrap">
        {row.display_name}
        {!row.has_board_row && (
          <span className="ml-1.5">
            <StatusChip tone="slate">Not on Onboarding Board</StatusChip>
          </span>
        )}
      </div>
      {position && <div className="text-[12px] text-slate-500 whitespace-nowrap">{position}</div>}
    </div>
  );

  // ── Start cell ──────────────────────────────────────────────────────────
  let startCell: React.ReactNode;
  if (!start) {
    startCell = (
      <span className="inline-flex items-center gap-1">
        {muted}
        <span className="inline-flex items-center rounded-full px-2 py-px text-[11px] font-semibold bg-status-yellow-fill text-status-yellow-ink">
          No Start Date
        </span>
      </span>
    );
  } else {
    startCell = (
      <span className="whitespace-nowrap">
        {fmtDay(start, thisYear)}
        {startMismatch && (
          <span
            className="ml-1 text-amber-500 cursor-help"
            title={`Roster start: ${fmtDay(start, thisYear)} · Board start: ${fmtDay(row.board_start, thisYear)}`}
          >
            ⚠
          </span>
        )}
      </span>
    );
  }

  return (
    <tr className="hover:bg-slate-100 transition-colors duration-100">
      {/* Employee (+ position) */}
      <td className="px-3 py-2">{nameCell}</td>
      {/* State */}
      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
        {row.has_board_row ? (row.state || muted) : muted}
      </td>
      {/* Start */}
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{startCell}</td>
      {/* Tenure */}
      <td className="px-3 py-2 tabular-nums text-slate-600 whitespace-nowrap">{tenure ? tenureDisplay(tenure) : muted}</td>
      {/* Contract end */}
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
        <ContractEndCell row={row} thisYear={thisYear} />
      </td>
      {/* Milestones */}
      <MilestoneCells row={row} thisYear={thisYear} />
    </tr>
  );
}
