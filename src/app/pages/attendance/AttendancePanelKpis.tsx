import type { ActivityDay } from '@/app/lib/activityDays';
import type { EmpStats } from '@/app/lib/attendanceStats';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';

type Props = {
  days: ActivityDay[];
  stats: EmpStats | null;
};

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-muted/30 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[100px] flex-1">
      <span className={`text-xl font-bold tabular-nums ${accent ?? 'text-slate-800'}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function avgOrNull(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default function AttendancePanelKpis({ days, stats }: Props) {
  // Only days with actual work records
  const workedDays = days.filter(d => d.activeMin > 0);

  const avgActive = avgOrNull(workedDays.map(d => d.activeMin));
  const avgEntry  = avgOrNull(
    days.filter(d => d.shownFirstMin !== null).map(d => d.shownFirstMin as number),
  );

  const needsLookCount = days.filter(d => d.needsLook).length;

  const onTimeLabel = stats && stats.days > 0
    ? `${stats.pctOnTime.toFixed(0)}%`
    : '—';

  return (
    <div className="flex flex-wrap gap-2">
      <Tile
        label="Avg Active"
        value={avgActive !== null ? fmtDuration(avgActive) : '—'}
        accent="text-[#2AA876]"
      />
      <Tile
        label="Avg Entry"
        value={avgEntry !== null ? fmtClock(avgEntry) : '—'}
      />
      <Tile
        label="On Time"
        value={onTimeLabel}
        accent={
          !stats || stats.days === 0 ? undefined :
          stats.pctOnTime >= 90 ? 'text-[#2AA876]' :
          stats.pctOnTime >= 75 ? 'text-amber-600' :
          'text-red-600'
        }
      />
      <Tile
        label="Needs A Look"
        value={needsLookCount}
        accent={needsLookCount > 0 ? 'text-amber-600' : undefined}
      />
    </div>
  );
}
