import { Check } from 'lucide-react';
import { fmtDay } from '@/app/lib/fmtDay';
import { inDaysLabel, SOON_DAYS } from '@/app/lib/contractChips';
import type { ContractRowData } from './ContractRow';

// Milestone and Contract End cells for ContractRow (Warm redesign, 2026-10-07).
// Excel status colours: green = done / renewed, yellow = soon or pending, red = ending / not renewed.

const muted = <span className="text-slate-300">—</span>;

const MS_TIPS: Record<string, string> = {
  '1m': 'Start + 1 month.', '3m': 'Start + 3 months.', '6m': 'Start + 6 months.',
  '1y': 'Start + 1 year.',  '2y': 'Start + 2 years.',
};

const pill = 'inline-flex items-center rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap';

export function MilestoneCells({ row, thisYear }: { row: ContractRowData; thisYear: string }) {
  const { ms, next } = row;
  if (!ms) {
    return <>{['1m', '3m', '6m', '1y', '2y'].map(k => <td key={k} className="px-3 py-2">{muted}</td>)}</>;
  }
  return (
    <>
      {ms.map(m => {
        const isPast = next ? m.date < next.date : true;
        const isNext = next?.key === m.key;
        if (isNext) {
          const soon = next.days <= SOON_DAYS;
          const box = soon
            ? 'bg-status-yellow-fill border-status-yellow-fill'
            : 'bg-warm-tint border-warm-ring';
          return (
            <td key={m.key} className="px-3 py-2 whitespace-nowrap">
              <span className={`inline-flex flex-col items-start gap-px rounded-md border px-2 py-0.5 ${box}`} title={MS_TIPS[m.key]}>
                <span className="text-[12px] font-semibold text-slate-900 tabular-nums">{fmtDay(m.date, thisYear)}</span>
                <span className={`text-[11px] font-semibold ${soon ? 'text-status-yellow-ink' : 'text-warm-text'}`}>{inDaysLabel(next.days)}</span>
              </span>
            </td>
          );
        }
        if (isPast) {
          return (
            <td key={m.key} className="px-3 py-2 whitespace-nowrap" title={`${MS_TIPS[m.key]} Reached ${fmtDay(m.date, thisYear)}.`}>
              <span className="inline-flex items-center gap-1.5 font-medium text-status-green-ink">
                <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.4} aria-hidden="true" />
                Done
              </span>
            </td>
          );
        }
        return (
          <td key={m.key} className="px-3 py-2 text-slate-400 tabular-nums whitespace-nowrap" title={MS_TIPS[m.key]}>
            {fmtDay(m.date, thisYear)}
          </td>
        );
      })}
    </>
  );
}

export function ContractEndCell({ row, thisYear }: { row: ContractRowData; thisYear: string }) {
  const { end, endState, renewal } = row;
  if (!row.has_board_row || endState.kind === 'none' || !end) return muted;
  const day = fmtDay(end, thisYear);

  if (endState.kind === 'ended') {
    if (renewal === 'renewed') {
      return (
        <span title={`Board status Passed. Fixed term ended on ${day}.`}>
          <span className={`${pill} bg-status-green-fill text-status-green-ink`}>Renewed · was {day}</span>
        </span>
      );
    }
    if (renewal === 'not_renewed') {
      return (
        <span title="Board status Failed — still on the active roster.">
          <span className={`${pill} bg-status-red-fill text-status-red-ink`}>Not Renewed</span>
          <div className="text-[11px] text-slate-500 mt-0.5">ended {day}</div>
        </span>
      );
    }
    return (
      <span title="Fixed term ended and the board has no renewal decision yet.">
        <span className={`${pill} bg-status-yellow-fill text-status-yellow-ink`}>Pending Review</span>
        <div className="text-[11px] text-slate-500 mt-0.5">ended {day}</div>
      </span>
    );
  }

  // future
  const days = endState.days ?? 0;
  const label = `${day} · ${inDaysLabel(days)}`;
  let main: React.ReactNode;
  if (days <= 30) main = <span className={`${pill} bg-status-red-fill text-status-red-ink`}>{label}</span>;
  else if (days <= 60) main = <span className={`${pill} bg-status-yellow-fill text-status-yellow-ink`}>{label}</span>;
  else main = <span className="whitespace-nowrap tabular-nums">{day}</span>;
  return (
    <span className="inline-flex flex-col items-start">
      {main}
      {renewal === 'renewed' && (
        <span className={`${pill} mt-0.5 bg-status-green-fill text-status-green-ink`}>Renewed</span>
      )}
      {renewal === 'not_renewed' && (
        <span className={`${pill} mt-0.5 bg-status-red-fill text-status-red-ink`}>Not Renewed</span>
      )}
    </span>
  );
}
