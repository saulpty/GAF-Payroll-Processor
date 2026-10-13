import MobileRow from '@/app/components/mobile/MobileRow';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { TodayRow } from '@/app/lib/teramindToday';
import { fmtTime } from '@/app/lib/fmtTime';
import type { WhyChip } from '@/app/lib/activityDays';
import { isOffToday, todayLate, todayTone } from '@/app/lib/todayRows';
import WhyChipBadge from './activity/WhyChipBadge';
import { STATUS_CHIP, isOnLeave } from './TodayRow';

// The Today board on a phone: one row per employee, built from the same row objects, in the same
// order, as TodayTable. The page renders this OR the table, never both. Status colours and the
// On Leave rule are imported from TodayRow.tsx; the formats below are the table's own.
const ON_LEAVE = { label: 'On Leave', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
const LATE_CLS = { on_time: '', grace: 'text-amber-700 font-medium', late: 'text-status-red-ink font-semibold' } as const;
const clock = (min: number) => fmtTime(fmtClock(min));
const lateBy = (m: number) => (m < 60 ? `+${m} min` : `+${fmtDuration(m)}`);

/** Grey placeholder rows at the real row height, shown while the first load is running. */
export function TodayRowsLoading() {
  return (
    <div className="-mx-4 bg-white border-t border-slate-200" role="status" aria-label="Loading attendance data">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse px-4 py-3">
          <div className="h-3.5 w-40 rounded bg-slate-200" />
          <div className="mt-2.5 h-3 w-56 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function TodayRows({
  rows, whyById, whyLoading, ghostByEmployee, onRowClick,
}: {
  rows: TodayRow[];
  whyById: Map<number, WhyChip | null>;
  whyLoading: boolean;
  ghostByEmployee: Map<number, number>;
  onRowClick?: (row: TodayRow) => void;
}) {
  // -mx-4: on a phone the page area has 16 px of side padding; the rows run edge to edge.
  return (
    <div className="-mx-4 bg-white border-t border-slate-200">
      {rows.map(row => {
        const why = whyLoading ? undefined : (whyById.get(row.employeeId) ?? null);
        const onLeave = isOnLeave(row.status, why);
        const chip = onLeave ? ON_LEAVE : STATUS_CHIP[row.status];
        const chipLabel = !onLeave && row.status === 'holiday' && row.holidayName ? row.holidayName : chip.label;
        const shift = row.scheduledStartMin !== null && row.scheduledEndMin !== null
          ? `${clock(row.scheduledStartMin)}–${clock(row.scheduledEndMin)}`
          : '';
        const late = todayLate(row);
        const ghostMin = ghostByEmployee.get(row.employeeId);
        const hasFacts = !!why || shift !== '' || row.entryMin !== null || ghostMin !== undefined;
        return (
          <MobileRow
            key={row.employeeId}
            title={row.name}
            right={(
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium border ${chip.cls}`}>
                {chipLabel}
              </span>
            )}
            facts={hasFacts ? (
              <>
                {why ? <WhyChipBadge chip={why} /> : shift !== '' && <span>{shift}</span>}
                {row.entryMin !== null && <span>In {clock(row.entryMin)}</span>}
                {late && (
                  <span className={LATE_CLS[late.level]}>
                    {late.level === 'on_time' ? 'On time' : lateBy(late.minutes)}
                  </span>
                )}
                {ghostMin !== undefined && <span className="text-[12px]">Early Record {fmtClock(ghostMin)} Ignored</span>}
              </>
            ) : undefined}
            tone={todayTone(row.status, onLeave)}
            muted={isOffToday(row)}
            chevron="right"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          />
        );
      })}
    </div>
  );
}
