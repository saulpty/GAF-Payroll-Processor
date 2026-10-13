import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { useViewer } from '@/app/context/ViewerContext';
import { getConfig, hasVisibleFilter } from '@/app/lib/filterRoutes';
import FilterBar from '@/app/FilterBar';
import MobileSheet from '@/app/components/mobile/MobileSheet';

// Phone, white bar, right side: the Filters button and the sheet it opens. SectionBar renders
// this only on a phone, on the manager sections.
//
// FilterBar MUST be mounted the whole time, not only while the sheet is open. It is more than
// the filter controls: it loads the periods and owns the two effects that pick the default
// period and set Periods or Dates for the route. If it only existed while the sheet was open,
// Attendance → List would open with no period chosen and show an empty page. So the sheet is
// `keepMounted` (its children stay rendered, hidden, while it is closed) and FilterBar is never
// put behind a condition here.
//
// The dot uses the same rule as Clear Filters (`hasVisibleFilter`). That rule must not count the
// period Attendance picks by itself, and only FilterBar knows which one that is (it comes from
// FilterBar's periods loader). FilterBar hands it up through `onDefaultPeriod`, so no query is
// repeated here; every other input is read from the filter context.
export default function MobileFilters() {
  const { pathname } = useLocation();
  const { period, employee, role, manager, attendanceMode, attendancePeriods } = useGlobalFilters();
  const { isSuper } = useViewer();
  const [open, setOpen] = useState(false);
  const [defaultPeriod, setDefaultPeriod] = useState<string | null>(null);

  const filterOn = hasVisibleFilter(getConfig(pathname), {
    period, employee, role, manager, isSuper, attendanceMode, attendancePeriods, defaultPeriod,
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="shrink-0 h-11 min-w-11 px-3.5 flex items-center gap-1.5 border-l border-slate-200 text-[13px] font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warm-ring"
      >
        Filters
        {filterOn && (
          <>
            <span className="w-2 h-2 rounded-full bg-warm" aria-hidden="true" />
            <span className="sr-only">(on)</span>
          </>
        )}
      </button>
      <MobileSheet keepMounted size="partial" title="Filters" open={open} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3 p-4">
          <FilterBar stacked onDefaultPeriod={setDefaultPeriod} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 w-full rounded-md bg-primary text-white text-[14px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring"
          >
            Done
          </button>
        </div>
      </MobileSheet>
    </>
  );
}
