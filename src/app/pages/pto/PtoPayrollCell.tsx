// Evidence-only cell: cycles + byType breakdown, no verdict words.
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';

interface Props {
  match: PayrollMatch;
  thisYear: string;
}

export default function PtoPayrollCell({ match, thisYear: _thisYear }: Props) {
  const { state, cycles, byType } = match;

  if (!state) return null;

  const byTypeTitle = byType.map(b => `${b.label} ×${b.count}${b.impact ? ` · ${b.impact}` : ''}`).join('; ');

  const hasData = cycles.length > 0 || byType.length > 0;

  if (!hasData || state === 'future' || state === 'invalid' || state === 'not_processed' || state === 'before_history' || state === 'no_rows') {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <div title={byTypeTitle}>
      {cycles.length > 0 && (
        <div className="font-mono text-[11px] text-slate-500">{cycles.join(', ')}</div>
      )}
      {byType.map((b, i) => (
        <div key={i} className="text-[12px] text-slate-600">
          {b.label} ×{b.count}
          {b.impact && <span className="text-slate-400"> · {b.impact}</span>}
        </div>
      ))}
    </div>
  );
}
