import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import { fmtTime } from '@/app/lib/fmtTime';
import type { TodayRow, TodayStatus } from '@/app/lib/teramindToday';
import type { WhyChip } from '@/app/lib/activityDays';
import GhostMark from '@/app/pages/attendance/activity/GhostMark';

export const STATUS_CHIP: Record<TodayStatus, { label: string; cls: string }> = {
  working:     { label: 'Working',      cls: 'bg-status-green-fill text-status-green-ink border-transparent' },
  away:        { label: 'Away',         cls: 'bg-status-yellow-fill text-status-yellow-ink border-transparent' },
  not_in_yet:  { label: 'Not In Yet',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  late_not_in: { label: 'No Records',  cls: 'bg-status-red-fill text-status-red-ink border-transparent' },
  finished:    { label: 'Finished',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  day_off:     { label: 'Day Off',      cls: 'bg-slate-100 text-slate-400 border-slate-200' },
  holiday:     { label: 'Holiday',      cls: 'bg-slate-100 text-slate-400 border-slate-200' },
  not_started: { label: 'Not Started', cls: 'bg-slate-100 text-slate-400 border-slate-200' },
};

const ON_LEAVE_KINDS = new Set(['pto', 'permission', 'sick', 'form', 'holiday'] as WhyChip['kind'][]);

const WHY_CHIP_CLS: Record<WhyChip['tone'], string> = {
  blue:  'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  gray:  'bg-slate-100 text-slate-500 border-slate-200',
};

export function isOnLeave(status: TodayStatus, why: WhyChip | null | undefined): boolean {
  return status === 'late_not_in' && why !== null && why !== undefined && ON_LEAVE_KINDS.has(why.kind);
}

export function TodayTableRow({
  row, isToday, why, ghostMin, tdCls,
}: {
  row: TodayRow;
  isToday: boolean;
  why: WhyChip | null | undefined;
  ghostMin?: number | null;
  tdCls: string;
}) {
  // Status chip: override to "On Leave" when applicable
  const offToday = row.status === 'day_off' && row.records === 0;
  const onLeave = isOnLeave(row.status, why);
  const chip = onLeave
    ? { label: 'On Leave', cls: 'bg-blue-50 text-blue-700 border-blue-200' }
    : STATUS_CHIP[row.status];
  const chipLabel =
    !onLeave && row.status === 'holiday' && row.holidayName ? row.holidayName : chip.label;

  const STATUS_TITLE: Record<string, string> = {
    working:     'Has Teramind activity in the last 15 minutes.',
    away:        'Clocked in but no activity detected in the last 15 minutes.',
    not_in_yet:  'Scheduled today, shift has started, no entry recorded yet.',
    late_not_in: 'Scheduled, past the grace period, no Teramind activity and no report on file.',
    finished:    'Last activity is at or after their scheduled end time.',
    day_off:     'Not scheduled to work today.',
    holiday:     'A company holiday — not a working day.',
    not_started: 'Shift has not started yet.',
    on_leave:    'A PTO, permission, sick form, other form or holiday covers today.',
  };
  const chipTitle = onLeave ? STATUS_TITLE.on_leave : (STATUS_TITLE[row.status] ?? '');

  // House formats (design system): 9AM–5PM, 9:05AM; minutes as 45 min, 1h 15m.
  const clock = (min: number) => fmtTime(fmtClock(min));
  const scheduledStr =
    row.scheduledStartMin !== null && row.scheduledEndMin !== null
      ? `${clock(row.scheduledStartMin)}–${clock(row.scheduledEndMin)}`
      : '—';
  const lateBy = (m: number) => (m < 60 ? `+${m} min` : `+${fmtDuration(m)}`);

  const lateStr =
    row.entryMin !== null ? (
      row.minutesLate === 0 ? (
        <span className="text-slate-500 text-xs">On time</span>
      ) : (
        <span className={row.lateAfterGrace ? 'text-status-red-ink font-semibold' : 'text-amber-700 font-medium'}>
          {lateBy(row.minutesLate)}
        </span>
      )
    ) : (
      <span className="text-slate-400">—</span>
    );

  const lastActivityStr =
    row.lastActivityMin !== null
      ? `${clock(row.lastActivityMin)}${row.lastActivityNextDay ? ' +1d' : ''}`
      : '—';

  const idleStr =
    isToday && (row.status === 'working' || row.status === 'away')
      ? fmtDuration(row.idleMinutes)
      : null;

  return (
    <tr className={`hover:bg-slate-50 transition-colors${offToday ? ' opacity-60' : ''}`}>
      <td className={tdCls}>
        <div className="font-medium leading-tight">{row.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{row.role}</div>
      </td>
      <td className={tdCls}>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${chip.cls}`}
          title={chipTitle}
        >
          {chipLabel}
        </span>
      </td>
      {/* Why column */}
      <td className={tdCls}>
        {why ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${WHY_CHIP_CLS[why.tone]}`}
          >
            {why.label}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap text-slate-600 text-xs`}>
        {scheduledStr}
      </td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>
        {row.entryMin !== null ? (
          clock(row.entryMin)
        ) : (
          <span className="text-slate-400">—</span>
        )}
        <GhostMark ghostMin={ghostMin ?? null} />
      </td>
      <td className={`${tdCls} tabular-nums`}>{lateStr}</td>
      <td className={`${tdCls} tabular-nums whitespace-nowrap`}>
        {lastActivityStr !== '—' ? lastActivityStr : <span className="text-slate-400">—</span>}
      </td>
      {isToday && (
        <td className={`${tdCls} tabular-nums`}>
          {idleStr !== null ? idleStr : <span className="text-slate-300">—</span>}
        </td>
      )}
      <td className={`${tdCls} tabular-nums`}>
        {row.activeMinutes > 0 ? fmtDuration(row.activeMinutes) : <span className="text-slate-400">—</span>}
      </td>
      <td className={tdCls}>
        <div className="flex items-center gap-1.5">
          {row.records > 0 && (
            <span className="text-xs text-slate-600 tabular-nums">{row.records}</span>
          )}
          {row.hasManual && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
              Manual
            </span>
          )}
          {row.records === 0 && <span className="text-slate-400">—</span>}
        </div>
      </td>
    </tr>
  );
}
