import { Clock, Hourglass, AlertTriangle, Check } from 'lucide-react';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import { fmtDay } from '@/app/lib/fmtDay';

interface Props {
  match: PayrollMatch;
  leaveType: 'pto' | 'floating_holiday';
  thisYear: string;
  requestDays: number;
  leaveOn: string;
}

function CyclesByType({ cycles, byType }: { cycles: string[]; byType: { label: string; count: number }[] }) {
  return (
    <>
      {cycles.length > 0 && (
        <div className="font-mono text-[11px] text-slate-500">{cycles.join(', ')}</div>
      )}
      {byType.length > 0 && (
        <div className="text-slate-600">
          {byType.map(b => `${b.label} ×${b.count}`).join(', ')}
        </div>
      )}
    </>
  );
}

export default function PtoPayrollCell({ match, leaveType, thisYear, requestDays, leaveOn }: Props) {
  const { state, mismatch, cycles, byType, firstOff, actualReturn, actualDays, dataThrough } = match;
  const byTypeTitle = byType.map(b => `${b.label} ×${b.count}`).join(', ');
  const leaveLabel = leaveType === 'floating_holiday' ? 'floating holiday' : 'PTO';

  // Guard: if match is empty/placeholder (no state set), show nothing
  if (!state) return null;

  if (state === 'future') {
    return (
      <div className="flex items-center gap-1 text-slate-400">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Future</span>
      </div>
    );
  }

  if (state === 'not_processed') {
    return (
      <div>
        <div className="flex items-center gap-1 text-amber-600">
          <Hourglass className="w-3.5 h-3.5 shrink-0" />
          <span>Not processed yet</span>
        </div>
        {dataThrough && (
          <div className="text-slate-400">
            payroll runs through {fmtDay(dataThrough, thisYear)}
          </div>
        )}
      </div>
    );
  }

  if (state === 'no_rows') {
    return <span className="text-slate-400">No payroll rows</span>;
  }

  if (state === 'worked') {
    return (
      <div title={byTypeTitle}>
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Worked these days</span>
        </div>
        <CyclesByType cycles={cycles} byType={byType} />
      </div>
    );
  }

  if (state === 'partial') {
    return (
      <div title={byTypeTitle}>
        <CyclesByType cycles={cycles} byType={byType} />
        <div className="text-slate-400">
          Return not in payroll yet
          {dataThrough && ` · runs through ${fmtDay(dataThrough, thisYear)}`}
        </div>
      </div>
    );
  }

  // state === 'matched'
  if (firstOff === null) {
    return (
      <div title={byTypeTitle}>
        <CyclesByType cycles={cycles} byType={byType} />
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>No {leaveLabel} day in payroll</span>
        </div>
      </div>
    );
  }

  if (actualReturn === null) {
    return (
      <div title={byTypeTitle}>
        <CyclesByType cycles={cycles} byType={byType} />
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Off {fmtDay(firstOff, thisYear)} · return not in payroll</span>
        </div>
      </div>
    );
  }

  if (!mismatch) {
    return (
      <div title={byTypeTitle}>
        <CyclesByType cycles={cycles} byType={byType} />
        <div className="text-slate-600 flex items-center gap-1">
          <span>Back {fmtDay(actualReturn, thisYear)} · {actualDays} {actualDays === 1 ? 'day' : 'days'}</span>
          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 inline" />
        </div>
      </div>
    );
  }

  // matched with mismatch
  const startedDiff = firstOff !== leaveOn;
  return (
    <div title={byTypeTitle}>
      <CyclesByType cycles={cycles} byType={byType} />
      <div className="flex items-start gap-1 text-amber-600">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Back {fmtDay(actualReturn, thisYear)} ·{' '}
          {startedDiff && `started ${fmtDay(firstOff, thisYear)} · `}
          {actualDays} {actualDays === 1 ? 'day' : 'days'}, not {requestDays}
        </span>
      </div>
    </div>
  );
}
