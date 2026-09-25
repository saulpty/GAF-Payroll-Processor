import { Combobox } from '@/app/components/ds/Combobox';
import { NEEDS_EVENT } from './arLogic';

/** AR-5: filter the work table by event, or show only rows that still need one. */
export function ArToolbar({ eventOpts, eventFilter, setEventFilter, needsEventCount, shown, total }: {
  eventOpts: string[];
  eventFilter: string;
  setEventFilter: (v: string) => void;
  needsEventCount: number;
  shown: number;
  total: number;
}) {
  const needsOn = eventFilter === NEEDS_EVENT;
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-600">
        Event
        <Combobox value={needsOn ? '' : eventFilter} options={eventOpts} onChange={setEventFilter}
          placeholder="All Events" ariaLabel="Filter by event" className="w-48" />
      </label>
      <button type="button" aria-pressed={needsOn} onClick={() => setEventFilter(needsOn ? '' : NEEDS_EVENT)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${
          needsOn ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        }`}>
        Needs an Event <span className="font-bold tabular-nums">{needsEventCount}</span>
      </button>
      <span className="text-[12px] text-slate-500">
        {shown === total ? `Showing all ${total}` : `Showing ${shown} of ${total}`}
      </span>
    </div>
  );
}
