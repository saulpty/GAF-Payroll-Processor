import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtDuration } from '@/app/lib/teramindToday';

const INITIAL_LIMIT = 10;

type Props = {
  days: ActivityDay[];
  onPick?: (employeeId: number) => void;
};

export default function ActivityNeedsLook({ days, onPick }: Props) {
  const [showAll, setShowAll] = useState(false);
  const flagged = days.filter(d => d.needsLook);
  if (flagged.length === 0) return null;

  const visible = showAll ? flagged : flagged.slice(0, INITIAL_LIMIT);
  const hasMore = flagged.length > INITIAL_LIMIT;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-800">
          Needs A Look — {flagged.length} {flagged.length === 1 ? 'Day' : 'Days'}
        </span>
      </div>
      <ul className="space-y-1">
        {visible.map(d => (
          <li key={`${d.employeeId}-${d.date}`} className="flex items-baseline gap-2 text-sm text-amber-800">
            {onPick ? (
              <button
                type="button"
                className="font-medium shrink-0 hover:underline underline-offset-2 text-amber-900 transition-colors"
                onClick={() => onPick(d.employeeId)}
              >
                {d.employeeName}
              </button>
            ) : (
              <span className="font-medium shrink-0">{d.employeeName}</span>
            )}
            <span className="text-amber-600 shrink-0">{fmtDayShort(d.date)}</span>
            <span className="text-amber-700">·</span>
            <span>{buildReason(d)}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="mt-2 text-xs font-medium text-amber-700 hover:text-amber-900 underline-offset-2 hover:underline transition-colors"
        >
          {showAll ? 'Show Less' : `Show All (${flagged.length})`}
        </button>
      )}
    </div>
  );
}

function buildReason(d: ActivityDay): string {
  if (d.records === 0) return 'No Records';
  const activePart = `${fmtDuration(d.activeMin)} Active`;
  if (d.flag === 'long_break' && d.largestGapMin > 0) {
    return `${activePart} · Lunch Gap ${fmtDuration(d.largestGapMin)}`;
  }
  return activePart;
}
