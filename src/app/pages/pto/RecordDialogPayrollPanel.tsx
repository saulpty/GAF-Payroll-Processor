import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtDay, fmtRange } from '@/app/lib/fmtDay';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';

interface Requested {
  leaveOn: string;
  returnOn: string;
  days: number;
  reason?: string | null;
  submittedAt?: string | null;
  source: 'Monday' | 'ledger';
}

interface Props {
  requested: Requested;
  match: PayrollMatch | null;
  leaveType: 'pto' | 'floating_holiday';
  thisYear: string;
  onApply: (leaveOn: string, returnOn: string, days: number) => void;
}

function ByTypeLines({ byType }: { byType: { label: string; count: number; impact: string }[] }) {
  return (
    <>
      {byType.map((b, i) => (
        <div key={i}>
          {b.label} ×{b.count}
          {b.impact && <span className="text-sky-700/70"> · {b.impact}</span>}
        </div>
      ))}
    </>
  );
}

function PayrollBody({ match, thisYear }: { match: PayrollMatch | null; thisYear: string }) {
  if (!match) {
    return <span className="text-slate-500">No payroll data loaded</span>;
  }
  const { state, cycles, byType, firstOff, actualReturn, actualDays } = match;
  const cycleStr = cycles.join(', ');

  if (state === 'invalid') return <span className="text-red-600">Request dates are invalid</span>;
  if (state === 'future') return <span className="text-slate-500">Future — not in payroll yet</span>;
  if (state === 'not_processed') return <span className="text-slate-500">Not processed yet</span>;
  if (state === 'before_history') return <span className="text-slate-500">Before payroll history — recordable</span>;
  if (state === 'no_rows') return <span className="text-slate-500">No payroll rows found</span>;
  if (state === 'worked') return <span className="text-slate-500">Worked these days (no leave rows)</span>;

  if (state === 'partial') {
    return (
      <div className="text-sky-900 text-[13px] space-y-0.5">
        {cycleStr && <div className="font-mono text-[11px] text-sky-700">{cycleStr}</div>}
        <ByTypeLines byType={byType} />
        <div className="text-slate-500">Return not in payroll yet</div>
      </div>
    );
  }

  // matched
  if (!firstOff) {
    return <span className="text-slate-500">Rows exist but no leave day recorded</span>;
  }
  return (
    <div className="text-sky-900 text-[13px] space-y-0.5">
      {cycleStr && <div className="font-mono text-[11px] text-sky-700">{cycleStr}</div>}
      <ByTypeLines byType={byType} />
      <div>
        {actualReturn
          ? `Back ${fmtDay(actualReturn, thisYear)}`
          : 'Return not in payroll'}
      </div>
      {actualDays !== null && <div>{actualDays} day(s) off</div>}
    </div>
  );
}

export default function RecordDialogPayrollPanel({ requested, match, thisYear, onApply }: Props) {
  const canApply = match?.state === 'matched'
    && match.state !== 'invalid'
    && match.firstOff !== null
    && match.actualReturn !== null
    && match.actualDays !== null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Left: requested */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          {requested.source === 'Monday' ? 'Requested on Monday' : 'Recorded'}
        </div>
        <div className="text-[13px] text-slate-800">
          {fmtRange(requested.leaveOn, requested.returnOn, thisYear)}
        </div>
        <div className="text-[12px] text-slate-500 mt-0.5">
          {requested.days} day(s){requested.reason ? ` · "${requested.reason}"` : ''}
        </div>
        {requested.submittedAt && (
          <div className="text-[11px] text-slate-400 mt-0.5">
            Submitted {fmtDay(requested.submittedAt, thisYear)}
          </div>
        )}
      </div>

      {/* Right: payroll */}
      <div className="rounded-lg bg-sky-50 border border-sky-200 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          In payroll
          {match && match.cycles.length > 0 && (
            <span className="ml-1 font-mono text-sky-700 normal-case tracking-normal">
              {match.cycles.join(', ')}
            </span>
          )}
        </div>
        <PayrollBody match={match} thisYear={thisYear} />
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canApply}
            onClick={() => {
              if (canApply && match) {
                onApply(match.firstOff!, match.actualReturn!, match.actualDays!);
              }
            }}
          >
            <ArrowDown className="w-3.5 h-3.5 mr-1" />
            Use payroll dates
          </Button>
        </div>
      </div>
    </div>
  );
}
