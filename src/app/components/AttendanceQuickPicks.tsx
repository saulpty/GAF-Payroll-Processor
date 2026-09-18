// Quick-pick date buttons for the Attendance Dates mode in FilterBar.
import type { MouseEventHandler } from 'react';

type Handler = (() => void) | null;

interface QuickPick {
  label: string;
  handler: Handler;
}

export default function AttendanceQuickPicks({
  picks,
  btnCls,
}: {
  picks: QuickPick[];
  btnCls: string;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {picks.map(({ label, handler }) => (
        <button
          key={label}
          className={`${btnCls}${!handler ? ' opacity-40 cursor-not-allowed' : ''}`}
          onClick={(handler ?? undefined) as MouseEventHandler<HTMLButtonElement> | undefined}
          disabled={!handler}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
