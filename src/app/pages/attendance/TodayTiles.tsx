import InfoTip from '@/app/components/InfoTip';

function SummaryTile({
  label, value, accent, tip,
}: {
  label: string;
  value: number;
  accent?: string;
  tip?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-1 min-w-[90px]">
      <span className={`text-2xl font-bold tabular-nums ${accent ?? 'text-slate-800'}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-0.5">
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
    <div className="flex flex-wrap gap-3 mb-5">
      <SummaryTile
        label="Scheduled"
        value={scheduledCount}
        tip="Employees expected to work today. Excludes holidays and anyone whose schedule gives them the day off."
      />
      {isToday && (
        <SummaryTile
          label="Working"
          value={summary.working}
          accent="text-green-600"
          tip="Has Teramind activity in the last 15 minutes."
        />
      )}
      {isToday && (
        <SummaryTile
          label="Away"
          value={summary.away}
          accent="text-amber-600"
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
        accent={onLeaveCount > 0 ? 'text-blue-600' : undefined}
        tip="A PTO, permission, sick form, other form, or holiday covers today."
      />
      {offTodayCount > 0 && (
        <SummaryTile
          label="Off Today"
          value={offTodayCount}
          accent="text-slate-500"
          tip="Their schedule gives them the day off and no activity was recorded. They are listed, greyed out, at the bottom of the table."
        />
      )}
      <SummaryTile
        label="No Records"
        value={noRecordsCount}
        accent={noRecordsCount > 0 ? 'text-amber-600' : undefined}
        tip="Scheduled, past the grace period, no Teramind activity and no report on file."
      />
      <SummaryTile
        label="Finished"
        value={summary.finished}
        accent="text-blue-600"
        tip="Last activity is at or after their scheduled end time."
      />
      <SummaryTile
        label="Late Arrivals"
        value={summary.lateArrivals}
        accent={summary.lateArrivals > 0 ? 'text-red-600' : undefined}
        tip="Arrived after their scheduled start plus grace period."
      />
    </div>
  );
}
