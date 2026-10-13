import type { Measure, MeasureChange, Tone, Verdict } from '@/app/lib/activityTrend';
import { VERDICT_LABEL, changeText } from '@/app/lib/activityTrend';

// Excel status tokens for the three verdicts that mean something; neutral slate for the rest.
const LOOK: Record<Verdict, string> = {
  improved: 'bg-status-green-tint text-status-green-ink border-status-green-fill',
  worse:    'bg-status-red-tint text-status-red-ink border-status-red-fill',
  mixed:    'bg-status-yellow-tint text-status-yellow-ink border-status-yellow-fill',
  steady:   'bg-slate-100 text-slate-600 border-slate-200',
  nodata:   'bg-white text-slate-500 border-slate-200',
};

export function TrendPill({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-xs font-medium border whitespace-nowrap ${LOOK[verdict]}`}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

export const toneClass = (tone: Tone): string =>
  (tone === 'good' ? 'text-status-green-ink' : tone === 'bad' ? 'text-status-red-ink' : 'text-slate-500');

/** '12m earlier, better' — the words behind an arrow, for the tooltip and screen readers. */
export function arrowLabel(measure: Measure, change: MeasureChange): string {
  return `${changeText(measure, change)}, ${change.tone === 'good' ? 'better' : 'worse'}`;
}

/** Shown only when the measure moved past its minimum. The arrow is the direction the number
 *  went; the colour says whether that is good or bad. */
export function ChangeArrow({ measure, change }: { measure: Measure; change: MeasureChange }) {
  if (change.tone === '') return null;
  const label = arrowLabel(measure, change);
  return (
    <span className={`ml-1 text-xs font-bold ${toneClass(change.tone)}`} title={label} aria-label={label} role="img">
      {change.delta > 0 ? '↑' : '↓'}
    </span>
  );
}
