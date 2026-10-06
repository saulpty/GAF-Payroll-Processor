import InfoTip from '@/app/components/InfoTip';

// Warm look (2026-10-06): Title Case label with a coloured dot, number in the matching ink.
// dot / accent: Tailwind classes. Excel status inks for working / away / no records / late.
function SummaryTile({
  label, value, accent, dot, tip,
}: {
  label: string;
  value: number;
  accent?: string;
  dot?: string;
  tip?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[104px] shadow-card">
      <span className={`text-[22px] leading-7 font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{value}</span>
      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
        <span className={`w-2 h-2 rounded-full ${dot ?? 'bg-slate-300'}`} aria-hidden="true" />
        {label}
        {tip && <InfoTip text={tip} />}
      </span>
    </div>
  );
}

interface TodayTilesProps {
  scheduledCount: number;
  isToday: boolean;
  summary: {
    working: number;
    away: number;
    notInYet: number;
    finished: number;
    lateArrivals: number;
  };
  onLeaveCount: number;
  noRecordsCount: number;
  offTodayCount: number;
}

export default function TodayTiles({
  scheduledCount,
  isToday,
  summary,
  onLeaveCount,
  noRecordsCount,
  offTodayCount,
}: TodayTilesProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <SummaryTile
        label="Scheduled"
        value={scheduledCount}
        tip="Employees expected to work today. Excludes holidays and anyone whose schedule gives them the day off."
      />
      {isToday && (
        <SummaryTile
          label="Working"
          value={summary.working}
          accent="text-status-green-ink"
          dot="bg-green-600"
          tip="Has Teramind activity in the last 15 minutes."
        />
      )}
      {isToday && (
        <SummaryTile
          label="Away"
          value={summary.away}
          accent="text-status-yellow-ink"
          dot="bg-yellow-500"
          tip="Clocked in but no activity detected in the last 15 minutes."
        />
      )}
      {isToday && (
        <SummaryTile
          label="Not In Yet"
          value={summary.notInYet}
          tip="Scheduled today, shift has started, no entry recorded yet."
        />
      )}
      <SummaryTile
        label="On Leave"
        value={onLeaveCount}
        accent={onLeaveCount > 0 ? 'text-blue-700' : undefined}
        dot="bg-blue-600"
        tip="A PTO, permission, sick form, other form, or holiday covers today."
      />
      {offTodayCount > 0 && (
        <SummaryTile
          label="Off Today"
          value={offTodayCount}
          accent="text-slate-500"
          dot="bg-slate-300"
          tip="Their schedule gives them the day off and no activity was recorded. They are listed, greyed out, at the bottom of the table."
        />
      )}
      <SummaryTile
        label="No Records"
        value={noRecordsCount}
        accent={noRecordsCount > 0 ? 'text-status-red-ink' : undefined}
        dot="bg-red-600"
        tip="Scheduled, past the grace period, no Teramind activity and no report on file."
      />
      <SummaryTile
        label="Finished"
        value={summary.finished}
        accent="text-blue-700"
        dot="bg-blue-600"
        tip="Last activity is at or after their scheduled end time."
      />
      <SummaryTile
        label="Late Arrivals"
        value={summary.lateArrivals}
        accent={summary.lateArrivals > 0 ? 'text-status-red-ink' : undefined}
        dot="bg-red-600"
        tip="Arrived after their scheduled start plus grace period."
      />
    </div>
  );
}
