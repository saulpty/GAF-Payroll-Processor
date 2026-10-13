# Phone: the white bar becomes one line (tabs or filter chips) with a Filters button and sheet

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Plan step M2 (`docs/superpowers/plans/2026-10-12-mobile-view.md`). Today, on a phone, the white
bar under the navy one wraps into a block: tabs, then every filter, a third of the screen. After
this prompt, on a phone, on the four manager sections (Attendance, Disciplinary, Contracts, PTO
Tracker):

- The white bar is **one line, 44 px tall**. On the left: the section's pages (Today, Activity,
  List, Reports) on one line that slides sideways, with a soft fade on the right edge. In a
  section with no pages, the left side shows the filters in use as small chips
  ("Title: Intake 1"), or nothing. On the right, always in place: a **Filters** button with an
  orange dot when a filter is on. The section's name is not repeated (the navy bar shows it).
- **Filters** opens a sheet from the bottom holding the same filters as the computer, one per
  line, employee search first, then **Clear Filters** (when a filter is on) and **Done**.
- On **Payroll and Admin** pages on a phone, the white bar keeps the computer's contents but on
  one line that slides sideways instead of wrapping. No Filters button there.

**The filters are the existing `FilterBar` component, not a copy.** `FilterBar` does more than
draw the controls: it loads the periods and holds the two effects that choose the default period
and set Periods or Dates for each Attendance page. So on a phone it must be **mounted the whole
time**, hidden while the sheet is closed. If it only existed while the sheet was open, Attendance →
List would open with no period and show an empty page.

This prompt relies on three things earlier prompts in this folder created. **Use them; do not
create or change them:**

- `src/app/lib/useIsPhone.ts` exports `useIsPhone(): boolean`.
- The `phone:` Tailwind screen in `src/tailwind.config.js` (`phone:h-11` applies only on a phone).
- `src/app/components/mobile/MobileSheet.tsx`, default export, props
  `{ open: boolean; onClose: () => void; title: string; subtitle?: string; size?: 'partial' | 'full'; keepMounted?: boolean; children: ReactNode }`.
  With `keepMounted`, its children stay rendered (hidden) while it is closed, and opening or
  closing the sheet does not remount them.

**Only these files may change.** One new: `src/app/components/mobile/MobileFilters.tsx`. Five
edited: `src/app/SectionBar.tsx`, `src/app/FilterBar.tsx`,
`src/app/components/PeriodMultiSelect.tsx`, `src/app/components/EmployeeSearchInput.tsx`,
`src/app/components/AttendanceRangeControls.tsx`. **No other file may be touched.** No migration,
no action file.

Rules that hold for every prompt in this folder:

- Only these files may change: the six listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

More rules for this prompt:

- `src/app/lib/filterRoutes.ts` is **imported, never edited**. `GlobalFilterContext.tsx`,
  `ViewerContext.tsx`, `TopNav.tsx` and `app.tsx` are not edited either.
- **`FilterBar.tsx` is 12,966 bytes and must end under 15,000** (it ends at about 13,740). Make
  only the edits in section 3, exactly as written, and add nothing of your own: no extra comment,
  no reformatting, no extra blank lines. Its three `useLoadAction(...)` calls, its five existing
  `useEffect` blocks, and every line not quoted in section 3 stay exactly as they are. Action
  parameters stay flat, as they are now.
- No date code changes. (Dates in this app are `YYYY-MM-DD` strings compared as strings; never
  `new Date(str)` for date math. Nothing below needs to touch that.)
- Every class added to an existing element is either inside a `stacked ? … : …` / `inline ? … : …`
  choice whose computer side is the old text, or starts with `phone:`, or is `no-scrollbar` on an
  element that does not scroll on a computer. That is what keeps the computer view identical. Do
  not add any other class.
- Text boxes keep their font size here (another prompt handles it).

## 1. New file `src/app/components/mobile/MobileFilters.tsx` — the whole file

```tsx
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
```

## 2. `src/app/SectionBar.tsx` — five edits, nothing else

**2a.** Replace

```tsx
import { SECTIONS, getActiveSection, BADGE } from '@/app/TopNav';
```

with

```tsx
import { SECTIONS, getActiveSection, BADGE } from '@/app/TopNav';
import { useViewer } from '@/app/context/ViewerContext';
import { useIsPhone } from '@/app/lib/useIsPhone';
import MobileFilters from '@/app/components/mobile/MobileFilters';
```

**2b.** Replace

```tsx
  const { arVersion } = useGlobalFilters();
```

with

```tsx
  const { arVersion, employee, role, manager } = useGlobalFilters();
  const { isSuper } = useViewer();
  const isPhone = useIsPhone();
```

**2c.** Replace

```tsx
  if (!sec && !getConfig(location.pathname)) return null;
```

with

```tsx
  if (!sec && !getConfig(location.pathname)) return null;

  // Phone, manager sections (2026-10-13): one 44 px line. Left: this section's pages on a line
  // that slides sideways, or (no pages) the filters in use as chips. Right: the Filters button.
  // The navy bar already names the section. Payroll and Admin fall through to the bar below.
  if (isPhone && sec && sec.id !== 'payroll' && sec.id !== 'admin') {
    const cfg = getConfig(location.pathname);
    if (sec.links.length === 0 && !cfg) return null;
    const chips = [
      cfg?.employee && employee ? `Employee: ${employee}` : '',
      cfg?.manager && isSuper && manager ? `Manager: ${manager}` : '',
      cfg?.role && role ? `Title: ${role}` : '',
    ].filter(Boolean);
    return (
      <div className="shrink-0 bg-white border-b border-slate-200 h-11 flex items-center z-30">
        <div className="relative flex-1 min-w-0">
          {sec.links.length > 0 ? (
            <nav aria-label={`${sec.label} pages`} className="flex h-11 overflow-x-auto no-scrollbar pl-2 pr-6">
              {sec.links.map(l => {
                const isActive = location.pathname === l.to || location.pathname.startsWith(l.to + '/');
                return (
                  <button
                    key={l.to}
                    onClick={() => navigate(l.to)}
                    aria-current={isActive ? 'page' : undefined}
                    style={isActive ? { borderBottomColor: sec.color.accent } : undefined}
                    className={cn(
                      'h-11 min-w-11 px-3 border-b-2 text-[14px] whitespace-nowrap shrink-0 focus:outline-none',
                      isActive ? 'font-semibold text-slate-900' : 'border-transparent font-medium text-slate-500'
                    )}
                  >
                    {l.label}
                  </button>
                );
              })}
            </nav>
          ) : (
            <div className="flex items-center gap-1.5 h-11 overflow-x-auto no-scrollbar pl-4 pr-6">
              {chips.map(c => (
                <span key={c} className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 whitespace-nowrap">
                  {c}
                </span>
              ))}
            </div>
          )}
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
        </div>
        {cfg && <MobileFilters />}
      </div>
    );
  }
```

**2d.** Replace

```tsx
    <div className="shrink-0 bg-white border-b border-slate-200 px-5 min-h-[48px] flex flex-wrap items-center gap-x-3 z-30">
```

with

```tsx
    <div className="shrink-0 bg-white border-b border-slate-200 px-5 min-h-[48px] flex flex-wrap items-center gap-x-3 z-30 no-scrollbar phone:flex-nowrap phone:overflow-x-auto">
```

**2e.** Replace

```tsx
        <div className="flex items-center gap-2 h-12 min-w-0 max-w-full">
```

with

```tsx
        <div className="flex items-center gap-2 h-12 min-w-0 max-w-full phone:shrink-0 phone:max-w-none">
```

Everything else in this file stays exactly as it is: the `useLoadAction(loadUnresolvedCountAction, …)`
line, the `arVersion` effect, the tab buttons with their icons and badge, `<div className="flex-1" />`
and `<FilterBar />` at the end. The two new hook calls in 2b (`useViewer()`, `useIsPhone()`) sit
with the other hooks, above the first `return`; the block added in 2c contains no hook.

## 3. `src/app/FilterBar.tsx` — seven edits (3a to 3g), nothing else

**3a.** Replace

```tsx
export default function FilterBar() {
```

with

```tsx
type Props = {
  /** Phone Filters sheet (MobileFilters): one control per line, full width, employee first. */
  stacked?: boolean;
  /** Phone: gives MobileFilters the auto-picked period, for the dot on its button. */
  onDefaultPeriod?: (name: string) => void;
};

export default function FilterBar({ stacked = false, onDefaultPeriod }: Props) {
```

**3b.** Replace

```tsx
  }, [cfg?.periods, attendanceMode, periodPick.defaultName, attendancePeriods.length]);
```

with

```tsx
  }, [cfg?.periods, attendanceMode, periodPick.defaultName, attendancePeriods.length]);

  useEffect(() => {
    if (periodPick.defaultName) onDefaultPeriod?.(periodPick.defaultName);
  }, [periodPick.defaultName, onDefaultPeriod]);
```

**3c.** Replace

```tsx
  const inputCls = 'h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring';
```

with

```tsx
  const inputCls = 'h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring' + (stacked ? ' phone:h-11' : '');
```

**3d.** Replace

```tsx
  const boxCls   = 'h-8 flex items-center gap-1.5 pl-2.5 pr-1 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-warm-ring';
```

with

```tsx
  const boxCls   = 'h-8 flex items-center gap-1.5 pl-2.5 pr-1 border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-warm-ring' + (stacked ? ' phone:h-11 w-full' : '');
```

**3e.** Replace

```tsx
  const bareSel  = 'h-full max-w-[130px] bg-transparent text-[13px] text-slate-900 focus:outline-none';
```

with

```tsx
  const bareSel  = 'h-full max-w-[130px] bg-transparent text-[13px] text-slate-900 focus:outline-none' + (stacked ? ' flex-1 min-w-0 phone:max-w-none' : '');
```

**3f.** Replace

```tsx
    <div className="flex items-center justify-end gap-2 flex-wrap py-2 min-w-0">
```

with

```tsx
    <div className={stacked ? 'flex flex-col gap-3' : 'flex items-center justify-end gap-2 flex-wrap py-2 min-w-0 phone:flex-nowrap phone:shrink-0'}>
```

**3g.** Three small replacements further down, in this order.

Replace

```tsx
          divider={divider}
```

with

```tsx
          divider={divider}
          stacked={stacked}
```

Replace

```tsx
            className={inputCls + ' w-40'}
```

with

```tsx
            className={inputCls + ' w-40'}
            stacked={stacked}
```

Replace

```tsx
          className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-1">
```

with

```tsx
          className={'flex items-center gap-1 text-[12px] text-slate-400 hover:text-red-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-1' + (stacked ? ' h-11 justify-center phone:text-slate-600' : '')}>
```

Why the `phone:` prefix inside `stacked`: `stacked` only ever happens on a phone, and a `phone:`
class always wins over the unprefixed class it replaces (`phone:h-11` over `h-8`,
`phone:max-w-none` over `max-w-[130px]`). Do not swap them for unprefixed classes.

These must still be in the file, unchanged, when you finish:
`useLoadAction(loadPeriodsAction, [] as PeriodRow[])`,
`useLoadAction(loadAttendanceEmployeesAction, [] as EmpInfo[], { viewAs })`, the
`loadActionRequiredCountsAction` call with `{ periodName: period },`, the line
`setAttendancePeriods([def], rangeOf([def]));`, the line
`setAttendanceMode(ATTENDANCE_SWITCH_ROUTES[routeKey]!);`, the line
`const prevRouteRef = useRef<string | null>(null);`, the line
`const divider  = null;`, and `{hasVisibleFilter(cfg, {` above the Clear Filters button.

## 4. `src/app/components/EmployeeSearchInput.tsx` — six edits, nothing else

**4a.** Replace

```tsx
import { useState, useRef, useId, useCallback } from 'react';
```

with

```tsx
import { useState, useRef, useId, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**4b.** Replace

```tsx
  className?: string;
}
```

with

```tsx
  className?: string;
  /** Phone Filters sheet: full width and first in the column. */
  stacked?: boolean;
}
```

**4c.** Replace

```tsx
  className,
}: Props) {
```

with

```tsx
  className,
  stacked = false,
}: Props) {
```

**4d.** Replace

```tsx
  const showList = open && suggestions.length > 0;
```

with

```tsx
  // On a phone there is no suggestion list: typing already filters the page.
  const isPhone = useIsPhone();
  const showList = !isPhone && open && suggestions.length > 0;
```

**4e.** Replace

```tsx
    <div className="relative">
```

with

```tsx
    <div className={stacked ? 'relative order-first' : 'relative'}>
```

**4f.** Replace

```tsx
        className={className}
```

with

```tsx
        className={stacked ? cn(className, 'phone:w-full') : className}
```

## 5. `src/app/components/PeriodMultiSelect.tsx` — eight edits (5a to 5h), nothing else

**5a.** Replace

```tsx
  onChange: (names: string[]) => void;
};
```

with

```tsx
  onChange: (names: string[]) => void;
  /** Phone Filters sheet: the list opens in place, full width, instead of floating over the page. */
  inline?: boolean;
};
```

**5b.** Replace

```tsx
export default function PeriodMultiSelect({ periods, selected, onChange }: Props) {
```

with

```tsx
export default function PeriodMultiSelect({ periods, selected, onChange, inline = false }: Props) {
```

**5c.** Replace

```tsx
    <div ref={containerRef} className="relative">
```

with

```tsx
    <div ref={containerRef} className={inline ? 'relative w-full' : 'relative'}>
```

**5d.** Replace

```tsx
        className={btnCls}
```

with

```tsx
        className={inline ? btnCls + ' phone:h-11 w-full' : btnCls}
```

**5e.** Replace

```tsx
        <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto min-w-[260px]">
```

with

```tsx
        <div className={inline
          ? 'mt-1 bg-white border border-slate-200 rounded-lg max-h-56 overflow-auto'
          : 'absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto min-w-[260px]'}>
```

**5f.** Replace

```tsx
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors"
```

with

```tsx
                className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors phone:min-h-11"
```

**5g.** Two spans in each row. Replace

```tsx
                  <span className="rounded-full bg-status-yellow-fill px-2 py-0.5 text-[11px] font-medium text-status-yellow-ink whitespace-nowrap">
```

with

```tsx
                  <span className="rounded-full bg-status-yellow-fill px-2 py-0.5 text-[11px] font-medium text-status-yellow-ink whitespace-nowrap phone:text-[12px]">
```

Replace

```tsx
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
```

with

```tsx
                <span className="text-[11px] text-slate-400 whitespace-nowrap phone:text-[12px]">
```

**5h.** Replace

```tsx
                className="text-[12px] text-slate-500 hover:text-warm-text transition-colors"
```

with

```tsx
                className="text-[12px] text-slate-500 hover:text-warm-text transition-colors phone:min-h-11"
```

The open/close state, the outside-click and Esc handlers, `toggle`, `label` and `btnCls` stay as
they are: inside the sheet the list still opens and closes from its button, only in place.

## 6. `src/app/components/AttendanceRangeControls.tsx` — seven edits, nothing else

**6a.** Replace

```tsx
  divider: React.ReactNode;
}
```

with

```tsx
  divider: React.ReactNode;
  /** Phone Filters sheet: every box is a full-width, 44 px line and the period list opens in place. */
  stacked?: boolean;
}
```

**6b.** Replace

```tsx
  periods, rangeOf, allNamedPeriods, showDivider, divider,
}: Props) {
```

with

```tsx
  periods, rangeOf, allNamedPeriods, showDivider, divider, stacked = false,
}: Props) {
```

**6c.** Replace

```tsx
  const today = toLocalYMD(new Date());
```

with

```tsx
  // `stacked` only happens on a phone, so phone:h-11 (which always wins over h-8) is enough.
  const box  = stacked ? BOX + ' phone:h-11 w-full' : BOX;
  const bare = stacked ? BARE + ' flex-1 min-w-0' : BARE;

  const today = toLocalYMD(new Date());
```

**6d.** Replace

```tsx
      <div className="flex rounded-md border border-slate-300 overflow-hidden h-8">
```

with

```tsx
      <div className={'flex rounded-md border border-slate-300 overflow-hidden h-8' + (stacked ? ' phone:h-11' : '')}>
```

**6e.** Replace

```tsx
              className={`px-3 text-[12px] font-semibold border-r last:border-r-0 transition-colors ${
```

with

```tsx
              className={`${stacked ? 'flex-1 ' : ''}px-3 text-[12px] font-semibold border-r last:border-r-0 transition-colors ${
```

**6f.** Replace

```tsx
            periods={periods}
```

with

```tsx
            periods={periods}
            inline={stacked}
```

**6g.** Replace

```tsx
          <label className={BOX}>
            <span className={IN_LABEL}>From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={BARE} />
          </label>
          <label className={BOX}>
            <span className={IN_LABEL}>To</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={BARE} />
          </label>
          <label className={BOX}>
            <span className={IN_LABEL}>Quick</span>
            <select
              value=""
              onChange={e => quickPicks.find(q => q.label === e.target.value)?.handler?.()}
              className={BARE}
            >
```

with

```tsx
          <label className={box}>
            <span className={IN_LABEL}>From</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={bare} />
          </label>
          <label className={box}>
            <span className={IN_LABEL}>To</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={bare} />
          </label>
          <label className={box}>
            <span className={IN_LABEL}>Quick</span>
            <select
              value=""
              onChange={e => quickPicks.find(q => q.label === e.target.value)?.handler?.()}
              className={bare}
            >
```

The constants `BOX`, `IN_LABEL` and `BARE` at the top of the file, `addDaysStr`, `mondayOf` and
the five quick ranges stay exactly as they are.

## Acceptance — visible facts

On a phone (375 × 667, and again sideways at 667 × 375), signed in as a super user:

1. On Attendance, Disciplinary, Contracts and PTO Tracker the white bar is **one line, 44 px
   tall**, with a **Filters** button at its right end. The section's name is not repeated in it.
2. On Attendance the line shows **Today · Activity · List · Reports** as words; the current one is
   bold with a green underline; tapping each opens that page. If they do not all fit (sideways
   they do; on a very narrow phone they may not), the line slides sideways and Reports can be
   reached; the right edge fades to white.
3. **Open Attendance → List cold on a phone without opening Filters: the current period's rows show.**
   (Reload the app on that page, or arrive from Contracts. Do not tap Filters first.)
4. Tap **Filters** on Attendance → List: a sheet titled Filters comes up from the bottom with, top
   to bottom, **Search employee…**, the **Periods | Dates** switch, the period box with the date
   range under it, **Manager**, **Title**, and a full-width **Done**. Each is one full-width line
   at least 44 px tall. Nothing is cut off at the sides.
5. In the sheet, tap the period box: the list of periods opens **in place under the box** (it
   pushes Manager and Title down; it does not float over them). Tick a second period: the page
   behind updates, the box reads "2 periods", an orange dot appears on the Filters button.
6. Tap **Dates**: From, To and Quick appear as three full-width lines. Pick **Last 14 Days**. Tap
   **Done**. Tap **Filters** again: the switch **still says Dates** and From/To still hold the
   range. (This proves the filters are not rebuilt each time the sheet opens or closes.)
7. On Attendance → Activity (which starts on Dates), open Filters, tap **Periods**, tap **Done**,
   open Filters again: it still says **Periods**.
8. On PTO Tracker, open Filters and choose a Title: the page behind is filtered; after **Done**
   the white bar shows a chip **Title: (the title chosen)** and the Filters button has an orange
   dot. Type a name in Search employee…: **no suggestion list drops down**, the page filters as
   you type, and a second chip **Employee: (what was typed)** appears. As a super user, choosing
   a Manager adds **Manager: (name)**.
9. Open Filters and tap **Clear Filters**: the chips and the dot disappear and the page shows
   everyone again. With no filter on, the sheet shows no Clear Filters line.
10. With no filter chosen, Attendance → List shows **no dot** (the period it picked by itself
    does not count), exactly as the computer shows no "Clear Filters" there.
11. Under View As a manager: the same four sections behave the same; the sheet has **no Manager**
    line and no Manager chip ever shows.
12. Super user, More → Payroll → Payroll Master, then Action Required and Process: the white bar
    is the computer's bar (section name, tabs with icons, the filters) on **one line that slides
    sideways**; it never wraps into two lines; there is no Filters button. Same on Admin (six tabs
    on one sliding line).
13. No console errors on load, after each tap, or when turning the phone.

On a computer nothing changes: the white bar is identical on every page (1440 wide, with a mouse):

14. Compare with the screenshot taken before this prompt on every page that has filters (Payroll
    Master, Process, Action Required, HRK Summary, Attendance Today / Activity / List / Reports,
    PTO Tracker, Contracts, Disciplinary) and on Period Log and Admin: same heights, same order,
    same widths. No Filters button anywhere.
15. Attendance → List: the period dropdown still **floats** over the page and closes on a click
    outside. Typing in Search employee… still drops the **suggestion list**.
16. Drag the window narrower than 768 px on PTO Tracker and back to wide: the bar turns into the
    one-line phone bar and back, and a Title chosen before is still chosen after.
17. No console errors.

When done, reply with a one-line summary per file.
