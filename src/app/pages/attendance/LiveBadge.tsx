// "Live" tag for a day Process Payroll has not run yet, shown from Teramind
// (liveAttendance.ts). Live days are shown but never counted in any number or rate.
// Modelled on activity/SourceBadge.tsx. Dashed border = not official yet.
import type { LiveInfo } from '@/app/lib/attendanceReportTypes';
import { fmtLiveTime } from '@/app/lib/liveAttendance';
import { fmtTime } from '@/app/lib/fmtTime';
import { fmtDuration } from '@/app/lib/teramindToday';

export const LIVE_TOOLTIP =
  'Not processed yet: shown from Teramind until payroll runs for this day. Not counted in any number.';

/** House minutes format: '45 min', '1h 15m'. */
export const fmtMins = (m: number): string => (m < 60 ? `${m} min` : fmtDuration(m));

/** Entry / exit of a live worked day: '9:05AM', '5:40PM so far', '1:10AM +1d'. */
export function liveInOut(l: LiveInfo): { entry: string; exit: string } {
  const t = (min: number | null) => fmtTime(fmtLiveTime(min));
  const exit = l.exitMin === null ? '' : t(l.exitMin);
  return {
    entry: t(l.entryMin),
    exit: exit === '' ? '' : l.inProgress ? `${exit} so far` : l.crossesMidnight ? `${exit} +1d` : exit,
  };
}

/** Text colour of a live label: late yellow, on time green, anything else neutral. */
export function liveLabelCls(l: LiveInfo): string {
  if (l.kind !== 'worked') return 'text-slate-600';
  return l.minutesLate > 0 ? 'text-status-yellow-ink' : 'text-status-green-ink';
}

type Props = { count?: number; title?: string };

export default function LiveBadge({ count, title }: Props) {
  return (
    <span
      title={title ?? LIVE_TOOLTIP}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-400 bg-white px-1.5 py-px text-[11px] font-medium text-slate-600 whitespace-nowrap cursor-default"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warm shrink-0" aria-hidden="true" />
      Live{count !== undefined ? ` · ${count}` : ''}
    </span>
  );
}
