import MobileRow from '@/app/components/mobile/MobileRow';
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import WhyChipBadge from './activity/WhyChipBadge';

type Props = {
  /** Already sorted by AttendancePanelDays (newest first): the same list its table renders. */
  days: ActivityDay[];
  /** Payroll rows by YYYY-MM-DD, built by AttendancePanelDays. */
  attByDate: Map<string, AttendanceRow>;
  /** AttendancePanelDays' own minutes format ('45 min', '1h 15m'). */
  fmtMins: (m: number) => string;
};

const CHIP = 'inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium';

// Day by Day on a phone: one row per day, the same days and the same facts as the table in
// AttendancePanelDays. Reading only, so the rows are not buttons.
// -mx-4: the sheet's content has 16 px of side padding; the rows run edge to edge.
export default function AttendancePanelDayRows({ days, attByDate, fmtMins }: Props) {
  return (
    <div className="-mx-4 bg-white border-t border-slate-200">
      {days.map(d => {
        const att = attByDate.get(d.date);
        const first = d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—';
        const last = d.shownLastMin !== null
          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
          : '—';
        return (
          <MobileRow
            key={d.date}
            title={fmtDayShort(d.date)}
            tone={d.needsLook ? 'yellow' : 'none'}
            facts={(
              <>
                <span className="whitespace-nowrap">{first} → {last}</span>
                {att && att.minutes_late > 0 && (
                  <span className="text-status-yellow-ink whitespace-nowrap">{fmtMins(att.minutes_late)} late</span>
                )}
                {d.needsLook && <span className={`${CHIP} bg-status-yellow-fill text-status-yellow-ink`}>Needs a Look</span>}
                {d.flag === 'long_break' && (
                  <span className={`${CHIP} bg-slate-100 text-slate-600 border border-slate-200`}>Long Break</span>
                )}
                {d.why && <WhyChipBadge chip={d.why} />}
                <span className="whitespace-nowrap">{fmtDuration(d.activeMin)} active</span>
                {d.ghostMin !== null && <span className="text-[12px]">Early Record {fmtClock(d.ghostMin)} Ignored</span>}
              </>
            )}
          />
        );
      })}
    </div>
  );
}
