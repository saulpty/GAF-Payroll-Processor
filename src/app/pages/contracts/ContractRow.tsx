import { fmtDate } from '@/app/lib/fmtDate';
import StatusChip from '@/app/components/StatusChip';

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
}

interface Props { row: ContractRowData }

const muted = <span className="text-slate-300">—</span>;

const MS_LABELS: Record<string, string> = {
  '1m': '1 m', '3m': '3 m', '6m': '6 m', '1y': '1 y', '2y': '2 y',
};
const MS_TIPS: Record<string, string> = {
  '1m': 'Start + 1 month.', '3m': 'Start + 3 months.', '6m': 'Start + 6 months.',
  '1y': 'Start + 1 year.',  '2y': 'Start + 2 years.',
};

export default function ContractRow({ row }: Props) {
  const { start, end, ms, next, tenure, endState, startMismatch } = row;

  // ── Employee cell ───────────────────────────────────────────────────────
  const nameCell = (
    <div>
      <div className="font-medium text-slate-900 whitespace-nowrap">
        {row.display_name}
        {!row.has_board_row && (
          <StatusChip tone="slate">
            Not on Onboarding board
          </StatusChip>
        )}
      </div>
    </div>
  );

  // ── Start cell ──────────────────────────────────────────────────────────
  let startCell: React.ReactNode;
  if (!start) {
    startCell = (
      <span className="inline-flex items-center gap-1">
        {muted}
        <StatusChip tone="amber">No start date</StatusChip>
      </span>
    );
  } else {
    startCell = (
      <span className="whitespace-nowrap">
        {fmtDate(start)}
        {startMismatch && (
          <span
            className="ml-1 text-amber-500 cursor-help"
            title={`Roster start: ${fmtDate(start)} · Board start: ${fmtDate(row.board_start ?? '')}`}
          >
            ⚠
          </span>
        )}
      </span>
    );
  }

  // ── Milestone cells ─────────────────────────────────────────────────────
  const msCells = ms
    ? ms.map(m => {
        const isPast = next ? m.date < next.date : true;
        const isNext = next?.key === m.key;
        if (isNext) {
          const label = next.days === 0 ? 'today' : `in ${next.days} d`;
          return (
            <td key={m.key} className="px-3 py-2 text-center whitespace-nowrap">
              <span
                className="inline-flex flex-col items-center rounded bg-primary/10 px-1.5 py-0.5 font-medium text-slate-800"
                title={MS_TIPS[m.key]}
              >
                <span className="text-[12px]">{fmtDate(m.date)}</span>
                <span className="text-[10px] text-primary">{label}</span>
              </span>
            </td>
          );
        }
        if (isPast) {
          return (
            <td key={m.key} className="px-3 py-2 text-center text-slate-300 whitespace-nowrap" title={fmtDate(m.date)}>
              ✔
            </td>
          );
        }
        return (
          <td key={m.key} className="px-3 py-2 text-center text-slate-400 tabular-nums whitespace-nowrap" title={MS_TIPS[m.key]}>
            {fmtDate(m.date)}
          </td>
        );
      })
    : ['1m', '3m', '6m', '1y', '2y'].map(k => (
        <td key={k} className="px-3 py-2 text-center">{muted}</td>
      ));

  // ── Contract end cell ───────────────────────────────────────────────────
  let endCell: React.ReactNode;
  if (endState.kind === 'none' || !end) {
    endCell = muted;
  } else if (endState.kind === 'ended') {
    endCell = (
      <span
        className="inline-flex flex-col items-start text-slate-400 whitespace-nowrap"
        title={`Their fixed term ended on ${fmtDate(end)} and they are still on the active roster.`}
      >
        <span className="text-[12px] font-medium">Renewed</span>
        <span className="text-[10px]">was {fmtDate(end)}</span>
      </span>
    );
  } else {
    // future
    const days = endState.days ?? 0;
    const label = `${fmtDate(end)} · in ${days} d`;
    if (days <= 30) {
      endCell = <StatusChip tone="red">{label}</StatusChip>;
    } else if (days <= 60) {
      endCell = <StatusChip tone="amber">{label}</StatusChip>;
    } else {
      endCell = <span className="whitespace-nowrap tabular-nums">{fmtDate(end)}</span>;
    }
  }

  return (
    <tr className="hover:bg-slate-50/80 transition-colors duration-100">
      {/* Employee */}
      <td className="px-3 py-2">{nameCell}</td>
      {/* Position */}
      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
        {row.has_board_row ? (row.position || muted) : muted}
      </td>
      {/* State */}
      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
        {row.has_board_row ? (row.state || muted) : muted}
      </td>
      {/* Start */}
      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{startCell}</td>
      {/* Tenure */}
      <td className="px-3 py-2 whitespace-nowrap">{tenure ?? muted}</td>
      {/* Contract end */}
      <td className="px-3 py-2 whitespace-nowrap">
        {row.has_board_row ? endCell : muted}
      </td>
      {/* Milestones */}
      {msCells}
    </tr>
  );
}

// Re-export MS_LABELS for column headers
export { MS_LABELS };
