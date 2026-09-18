// Attendance Periods | Dates segmented switch rendered in FilterBar.
// Reads GlobalFilterContext directly; receives processed/all periods as props.
import { useMemo } from 'react';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { toLocalYMD } from '@/app/lib/classificationEngine';
import { fmtDate } from '@/app/lib/fmtDate';
import PeriodMultiSelect from '@/app/components/PeriodMultiSelect';
import type { MouseEventHandler } from 'react';

export type NormalizedPeriod = {
  period_name: string;
  start_date: string;
  end_date: string;
};

export type AllNamedPeriod = NormalizedPeriod & { processed_at: string | null };

/** Add n days to a YYYY-MM-DD string (uses Date only for arithmetic, not TZ conversion). */
function addDaysStr(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toLocalYMD(d);
}

/** Monday of the ISO week containing todayYmd. */
function mondayOf(todayYmd: string): string {
  const d = new Date(todayYmd + 'T12:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return toLocalYMD(d);
}

type Handler = (() => void) | null;

function QuickPickButton({ label, handler, btnCls }: { label: string; handler: Handler; btnCls: string }) {
  return (
    <button
      className={`${btnCls}${!handler ? ' opacity-40 cursor-not-allowed' : ''}`}
      onClick={(handler ?? undefined) as MouseEventHandler<HTMLButtonElement> | undefined}
      disabled={!handler}
    >
      {label}
    </button>
  );
}

interface Props {
  processedPeriods: NormalizedPeriod[];
  allNamedPeriods: AllNamedPeriod[];
  /** Show a divider after the range block when employee/manager/role follow */
  showDivider: boolean;
  inputCls: string;
  labelCls: string;
  divider: React.ReactNode;
}

export default function AttendanceRangeControls({
  processedPeriods, allNamedPeriods, showDivider, inputCls, labelCls, divider,
}: Props) {
  const {
    attendanceMode, setAttendanceMode,
    attendancePeriods, setAttendancePeriods,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
  } = useGlobalFilters();

  const rangeOf = (names: string[]) => {
    const selected = processedPeriods.filter(p => names.includes(p.period_name));
    if (!selected.length) return null;
    const from = selected.map(p => p.start_date).sort()[0]!;
    const to   = selected.map(p => p.end_date).sort().reverse()[0]!;
    return { from, to };
  };

  const today = toLocalYMD(new Date());

  const qBtnCls = 'h-7 px-2.5 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap';

  const quickPicks = useMemo(() => {
    return [
      { label: 'Today',         handler: (() => { setDateFrom(today); setDateTo(today); }) as Handler },
      { label: 'This Week',     handler: (() => { setDateFrom(mondayOf(today)); setDateTo(today); }) as Handler },
      { label: 'Last 14 Days',  handler: (() => { setDateFrom(addDaysStr(today, -13)); setDateTo(today); }) as Handler },
      { label: 'Last 30 Days',  handler: (() => { setDateFrom(addDaysStr(today, -29)); setDateTo(today); }) as Handler },
      { label: 'Last 90 Days',  handler: (() => { setDateFrom(addDaysStr(today, -89)); setDateTo(today); }) as Handler },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  return (
    <>
      {/* Segmented switch */}
      <div className="flex rounded-lg border overflow-hidden shadow-sm h-8">
        {(['periods', 'dates'] as const).map(mode => {
          const isActive = attendanceMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setAttendanceMode(mode)}
              className={`px-3 text-[12px] font-semibold border-r last:border-r-0 transition-colors ${
                isActive ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {mode === 'periods' ? 'Periods' : 'Dates'}
            </button>
          );
        })}
      </div>

      {attendanceMode === 'periods' ? (
        <>
          <PeriodMultiSelect
            periods={processedPeriods}
            selected={attendancePeriods}
            onChange={names => setAttendancePeriods(names, names.length ? rangeOf(names) : null)}
          />
          {attendancePeriods.length > 0 && dateFrom && dateTo && (
            <span className="text-[12px] text-slate-500 tabular-nums whitespace-nowrap">
              {fmtDate(dateFrom)} → {fmtDate(dateTo)}
            </span>
          )}
        </>
      ) : (
        <>
          <label className={labelCls}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          <label className={labelCls}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          <div className="flex items-center gap-1.5 flex-wrap">
            {quickPicks.map(({ label, handler }) => (
              <QuickPickButton key={label} label={label} handler={handler} btnCls={qBtnCls} />
            ))}
          </div>
        </>
      )}
      {showDivider && divider}
    </>
  );
}
