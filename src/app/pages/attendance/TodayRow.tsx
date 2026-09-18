import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { TodayRow, TodayStatus } from '@/app/lib/teramindToday';
import type { WhyChip } from '@/app/lib/activityDays';

export const STATUS_CHIP: Record<TodayStatus, { label: string; cls: string }> = {
  working:     { label: 'Working',      cls: 'bg-green-100 text-green-700 border-green-200' },
  away:        { label: 'Away',         cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  not_in_yet:  { label: 'Not In Yet',  cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  late_not_in: { label: 'No Records',  cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  finished:    { label: 'Finished',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
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
  row, isToday, why, tdCls,
}: {
  row: TodayRow;
  isToday: boolean;
  why: WhyChip | null | undefined;
  tdCls: string;
}) {
  // Status chip: override to "On Leave" when applicable
  const onLeave = isOnLeave(row.status, why);
  const chip = onLeave
    ? { label: 'On Leave', cls: 'bg-blue-100 text-blue-700 border-blue-200' }
    : STATUS_CHIP[row.status];
  const chipLabel =
    !onLeave && row.status === 'holiday' && row.holidayName ? row.holidayName : chip.label;

  const scheduledStr =
    row.scheduledStartMin !== null && row.scheduledEndMin !== null
      ? `${fmtClock(row.scheduledStartMin)} – ${fmtClock(row.scheduledEndMin)}`
      : '—';

  const lateStr =
    row.entryMin !== null ? (
      row.minutesLate === 0 ? (
        <span className="text-slate-400 text-xs">On Time</span>
      ) : (
        <span className={row.lateAfterGrace ? 'text-red-600 font-medium' : 'text-amber-600'}>
          +{row.minutesLate}m
        </span>
      )
    ) : (
      <span className="text-slate-400">—</span>
    );

  const lastActivityStr =
    row.lastActivityMin !== null
      ? `${fmtClock(row.lastActivityMin)}${row.lastActivityNextDay ? ' +1d' : ''}`
      : '—';

  const idleStr =
    isToday && (row.status === 'working' || row.status === 'away')
      ? fmtDuration(row.idleMinutes)
      : null;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className={tdCls}>
        <div className="font-medium leading-tight">{row.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{row.role}</div>
      </td>
      <td className={tdCls}>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${chip.cls}`}
        >
          {chipLabel}
        </span>
      </td>
      {/* Why column */}
      <td className={tdCls}>
        {why && why.kind !== 'none' ? (
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
          fmtClock(row.entryMin)
        ) : (
          <span className="text-slate-400">—</span>
        )}
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
