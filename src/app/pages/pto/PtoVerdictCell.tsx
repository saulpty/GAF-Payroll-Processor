// Verdict cell: icon + bold sentence + grey detail line + optional "also" extra.
import { CircleCheck, AlertTriangle, Hourglass, History, Clock, Minus, AlertCircle } from 'lucide-react';
import type { PayrollMatch } from '@/app/lib/ptoPayrollMatch';
import { fmtDay } from '@/app/lib/fmtDay';
import { defaultTotalDays } from '@/app/lib/ptoAccrual';

interface Props {
  match: PayrollMatch;
  leaveType: 'pto' | 'floating_holiday';
  requestDays: number;
  leaveOn: string;
  thisYear: string;
  today: string;
}

function plural(n: number | null, w: string): string {
  const count = n ?? 0;
  return `${count} ${w}${count === 1 ? '' : 's'}`;
}

export default function PtoVerdictCell({ match, leaveType, requestDays, leaveOn, thisYear, today }: Props) {
  const { state, mismatch, firstOff, actualReturn, actualDays, dataThrough, historyFrom, byType } = match;

  if (!state) return null;

  const isFh = leaveType === 'floating_holiday';

  type Tone = 'emerald' | 'amber' | 'red' | 'slate';
  const toneClass: Record<Tone, string> = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    slate: 'text-slate-600',
  };

  let tone: Tone = 'slate';
  let Icon = Minus;
  let sentence = '';
  let detail = '';

  if (state === 'invalid') {
    tone = 'red'; Icon = AlertCircle;
    sentence = 'Return is before leave';
    detail = 'fix the Monday request';
  } else if (state === 'future') {
    tone = 'slate'; Icon = Clock;
    sentence = "Hasn't happened yet";
    const daysUntil = defaultTotalDays(today, leaveOn);
    detail = plural(daysUntil, 'day');
  } else if (state === 'before_history') {
    tone = 'slate'; Icon = History;
    sentence = 'Before payroll history';
    detail = historyFrom ? `payroll starts ${fmtDay(historyFrom, thisYear)}` : '';
  } else if (state === 'not_processed') {
    tone = 'slate'; Icon = Hourglass;
    sentence = 'Payroll not run yet';
    detail = dataThrough ? `processed through ${fmtDay(dataThrough, thisYear)}` : '';
  } else if (state === 'partial') {
    tone = 'slate'; Icon = Hourglass;
    sentence = 'Not in payroll yet';
    detail = dataThrough ? `processed through ${fmtDay(dataThrough, thisYear)}` : '';
  } else if (state === 'no_rows') {
    tone = 'slate'; Icon = Minus;
    sentence = 'No payroll rows';
    detail = '';
  } else if (state === 'worked') {
    tone = 'amber'; Icon = AlertTriangle;
    sentence = 'Worked these days';
    detail = '';
  } else if (state === 'matched') {
    if (firstOff === null) {
      tone = 'amber'; Icon = AlertTriangle;
      if (isFh) {
        const firstLabel = byType.length > 0 ? byType[0].label : 'unknown';
        sentence = `Payroll has this as ${firstLabel}`;
        detail = 'not a floating holiday';
      } else {
        sentence = 'No PTO day in payroll';
        detail = '';
      }
    } else if (actualReturn === null) {
      tone = 'amber'; Icon = AlertTriangle;
      sentence = 'Return not in payroll';
      detail = `off from ${fmtDay(firstOff, thisYear)}`;
    } else if (!mismatch) {
      tone = 'emerald'; Icon = CircleCheck;
      if (isFh) {
        sentence = 'Matches';
        detail = `1 floating holiday, back ${fmtDay(actualReturn, thisYear)}`;
      } else {
        sentence = 'Matches';
        detail = `${plural(actualDays, 'day')}, back ${fmtDay(actualReturn, thisYear)}`;
      }
    } else {
      // mismatch
      tone = 'amber'; Icon = AlertTriangle;
      const startedDiff = firstOff !== leaveOn;
      const prefix = startedDiff ? `Started ${fmtDay(firstOff, thisYear)} · ` : '';
      sentence = `${prefix}Was out ${plural(actualDays, 'day')}, not ${requestDays}`;
      detail = actualReturn ? `back ${fmtDay(actualReturn, thisYear)}` : '';
    }
  }

  // "also" extras: entries whose type doesn't match the leave type, excluding Feriado
  const ownLabel = isFh ? null : 'PTO';
  const fhImpact = 'Floating Holiday / B-Day Off';
  const extras = state === 'matched' ? byType.filter(b => {
    if (b.label === 'Feriado') return false;
    if (isFh) return b.impact !== fhImpact;
    return b.label !== ownLabel;
  }) : [];

  return (
    <div className="flex items-start gap-1.5">
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${toneClass[tone]}`} />
      <div>
        <div className={`text-[13px] font-medium ${toneClass[tone]}`}>{sentence}</div>
        {detail && <div className="text-[11px] text-slate-400">{detail}</div>}
        {extras.map((b, i) => (
          <div key={i} className="text-[11px] text-amber-700">
            also {b.label}{b.count > 1 ? ` (×${b.count})` : ''}{b.impact ? ` · ${b.impact}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
