# Phone view, rows 2: the employee panel as a sheet

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today, tapping a person on Attendance opens the computer's side panel stretched to the
screen: a chart too small to read, two ring charts side by side, and an eight-column table that
has to be slid sideways. This prompt makes the panel a proper phone sheet: the name and shift in a
title bar that stays put, the four headline numbers, Day by Day as rows, then the seven small
numbers. The three charts are not drawn on a phone at all. On a computer nothing changes.

This prompt is written against the app as it is **after** prompt 08 (`MobileRow` exists).

**Only these files may change.** One new: `src/app/pages/attendance/AttendancePanelDayRows.tsx`.
Four edited: `src/app/pages/attendance/AttendancePanel.tsx`,
`src/app/pages/attendance/AttendancePanelBody.tsx`,
`src/app/pages/attendance/AttendancePanelDays.tsx`,
`src/app/pages/attendance/AttendancePanelKpis.tsx`. **No other file may be touched.** No migration,
no action file.

Rules:
- Only these files may change: the five listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean`. `AttendancePanel.tsx`
  already calls it once (`const isPhone = useIsPhone();`). Do not call it anywhere else in these
  files: the other files receive `isPhone` as a prop.
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:`,
  `max-md:` or any other variant.
- `src/app/components/mobile/MobileSheet.tsx` (default export), props
  `{ open, onClose, title, subtitle?, size?: 'partial' | 'full', keepMounted?, children }`.
- `src/app/components/mobile/MobileRow.tsx` (default export), created by prompt 08.

`src/app/pages/attendance/AttendanceDonuts.tsx` is **not** edited: on a phone it is simply never
rendered. The three places that open the panel (`AttendanceToday.tsx`, `src/app/pages/Attendance.tsx`,
`activity/ActivityByEmployee.tsx`) are not edited either: the panel takes the same props as before.

If `src/app/components/mobile/MobileRow.tsx` or `MobileSheet.tsx` does not exist, stop and say so.
Do not write them.

## 1. New file `src/app/pages/attendance/AttendancePanelDayRows.tsx` — the whole file

```tsx
import MobileRow from '@/app/components/mobile/MobileRow';
import type { ActivityDay } from '@/app/lib/activityDays';
import { fmtDayShort } from '@/app/lib/activityDays';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { STATUS_COLORS } from './AttendancePanelBody';
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
        const dot = att ? STATUS_COLORS[att.status] : undefined;
        const first = d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—';
        const last = d.shownLastMin !== null
          ? fmtClock(d.shownLastMin) + (d.crossesMidnight ? ' +1d' : '')
          : '—';
        return (
          <MobileRow
            key={d.date}
            title={fmtDayShort(d.date)}
            tone={d.needsLook ? 'yellow' : 'none'}
            right={att ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-slate-700 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-300" style={dot ? { background: dot } : undefined} />
                {att.status}
              </span>
            ) : undefined}
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
```

## 2. `src/app/pages/attendance/AttendancePanel.tsx`: two additions, nothing else

Every existing line stays exactly as it is, including the overlay, the panel, its
`isPhone ? '100%' : 'clamp(520px, 55vw, 900px)'` width and every `phone:` class already there.

**2a.** Directly after the line `import { useIsPhone } from '@/app/lib/useIsPhone';` add:

```tsx
import MobileSheet from '@/app/components/mobile/MobileSheet';
```

**2b.** Inside `AttendancePanel`, directly after the line

```tsx
  const dateRangeLine = `${fmtDayShort(safeFrom)} – ${fmtDayShort(safeTo)}`;
```

add a blank line and then

```tsx
  // On a phone the panel is a full sheet: the four headline numbers, Day by Day as rows, then the
  // seven small numbers. The charts are never rendered. The computer's panel below is unchanged.
  if (isPhone) {
    return (
      <MobileSheet
        size="full"
        open
        onClose={onClose}
        title={name || 'Employee'}
        subtitle={[subtitle, dateRangeLine].filter(Boolean).join(' · ')}
      >
        <div className="p-4 flex flex-col gap-6">
          {activityError ? (
            <p className="text-[13px] text-muted-foreground italic py-2">
              Couldn't load activity data for this range.
            </p>
          ) : (
            <>
              <AttendancePanelKpis days={panelDays} stats={stats} />
              <AttendancePanelDays days={panelDays} attendanceRows={stats?.rows ?? []} isPhone />
              {stats && <AttendancePanelBody stats={stats} isPhone />}
            </>
          )}
        </div>
      </MobileSheet>
    );
  }
```

It must sit there: after every hook and after the line
`if (!stats && resolvedId === null) return null;`, and directly above the existing `return (`.
The existing `return ( <> … </> )` below it is the computer's panel and is not touched.

## 3. `src/app/pages/attendance/AttendancePanelBody.tsx`: steps 3a to 3d, nothing else

The chart, its legend, `ArrivalTooltip`, `STATUS_COLORS`, `<AttendanceDonuts stats={stats} />` and
every `recharts` import stay exactly as they are. On a computer the page draws exactly what it
draws today.

**3a.** Replace

```tsx
type Props = { stats: EmpStats };
```

with

```tsx
type Props = { stats: EmpStats; isPhone?: boolean };
```

**3b.** In `MiniKpi` (the label under a small number), replace

```tsx
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
```

with

```tsx
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mt-0.5 phone:text-[12px] phone:normal-case phone:tracking-normal">{label}</div>
```

**3c.** The seven small numbers move, unchanged, into their own small component (step 3d) so a
phone can show them without the charts. Replace

```tsx
      {/* Mini KPIs */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <MiniKpi label="Expected"         value={stats.days}                        color="#1B3A6B" />
        <MiniKpi label="On Time"          value={stats.onTime}                      color="#2AA876" />
        <MiniKpi label="Reported"         value={stats.reported}                    color="#FBBF24" />
        <MiniKpi label="Unreported"       value={stats.unreported}                  color="#EF4444" />
        <MiniKpi label="Absent"           value={stats.absent}                      color="#B91C1C" />
        <MiniKpi label="Avg Min (worked)" value={stats.avgMinLate.toFixed(1)}       color="#94A3B8" />
        <MiniKpi label="% On-Time"        value={`${stats.pctOnTime.toFixed(0)}%`}  color="#2AA876" />
      </div>
```

with

```tsx
      {/* Mini KPIs */}
      <PanelNumbers stats={stats} />
```

**3d.** Replace

```tsx
export default function AttendancePanelBody({ stats }: Props) {
  const scatterPoints = computeArrivalScatter(stats.rows).map(p => ({
```

with

```tsx
/** The seven small numbers: seven across on a computer, three across on a phone. */
function PanelNumbers({ stats }: { stats: EmpStats }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 phone:grid-cols-3">
      <MiniKpi label="Expected"         value={stats.days}                        color="#1B3A6B" />
      <MiniKpi label="On Time"          value={stats.onTime}                      color="#2AA876" />
      <MiniKpi label="Reported"         value={stats.reported}                    color="#FBBF24" />
      <MiniKpi label="Unreported"       value={stats.unreported}                  color="#EF4444" />
      <MiniKpi label="Absent"           value={stats.absent}                      color="#B91C1C" />
      <MiniKpi label="Avg Min (worked)" value={stats.avgMinLate.toFixed(1)}       color="#94A3B8" />
      <MiniKpi label="% On-Time"        value={`${stats.pctOnTime.toFixed(0)}%`}  color="#2AA876" />
    </div>
  );
}

export default function AttendancePanelBody({ stats, isPhone = false }: Props) {
  // On a phone only the seven numbers are shown. Everything below this line (the arrival chart
  // and the two ring charts) is never rendered there.
  if (isPhone) return <PanelNumbers stats={stats} />;

  const scatterPoints = computeArrivalScatter(stats.rows).map(p => ({
```

## 4. `src/app/pages/attendance/AttendancePanelDays.tsx`: steps 4a to 4d, nothing else

The table, its eight columns and every cell stay exactly as they are.

**4a.** Directly after the line `import GhostMark from './activity/GhostMark';` add:

```tsx
import AttendancePanelDayRows from './AttendancePanelDayRows';
```

**4b.** Replace

```tsx
  attendanceRows?: AttendanceRow[];
};
```

with

```tsx
  attendanceRows?: AttendanceRow[];
  /** On a phone the days are rows (AttendancePanelDayRows), not a table. */
  isPhone?: boolean;
};
```

**4c.** Replace

```tsx
export default function AttendancePanelDays({ days, attendanceRows = [] }: Props) {
```

with

```tsx
export default function AttendancePanelDays({ days, attendanceRows = [], isPhone = false }: Props) {
```

**4d.** Replace

```tsx
      ) : (
        <div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">
```

with

```tsx
      ) : isPhone ? (
        <AttendancePanelDayRows days={sorted} attByDate={attByDate} fmtMins={fmtMins} />
      ) : (
        <div className="bg-white border border-border rounded-lg shadow-card overflow-hidden">
```

## 5. `src/app/pages/attendance/AttendancePanelKpis.tsx`: two edits, class strings only

The four headline numbers: two across on a phone, with a label no smaller than 12 px.

**5a.** In `Tile` (the label), replace

```tsx
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
```

with

```tsx
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground phone:text-[12px] phone:normal-case phone:tracking-normal">{label}</span>
```

**5b.** In `AttendancePanelKpis` (the box around the four tiles), replace

```tsx
    <div className="flex flex-wrap gap-2">
```

with

```tsx
    <div className="flex flex-wrap gap-2 phone:grid phone:grid-cols-2">
```

## Acceptance — visible facts

On a phone-sized screen (375 × 667):
1. Attendance → Today, tap a person: a sheet slides up over the page, almost the full height, with
   rounded top corners. Its title bar shows the person's name and, under it, their title, shift,
   manager and the date range. The title bar stays put while the rest scrolls.
2. In the sheet, top to bottom: four headline numbers, two across (Avg Active, Avg Entry, On Time,
   Needs A Look); then "Day by Day"; then seven small numbers, three across.
3. No chart anywhere in the sheet: no arrival chart, no ring charts, no chart legend.
4. Day by Day is rows, newest day first, no table and nothing to slide sideways. Each row: the date
   in bold, the payroll status with its coloured dot on the right, and under it `9:02 AM → 5:31 PM`,
   how late (`12 min late`) when late, any Why chips, and `7h 40m active`. A day that needs a look
   has a pale yellow background and a "Needs a Look" chip.
5. The round × (44 px) closes the sheet. So does Esc on a keyboard. The page behind does not
   scroll while the sheet is open.
6. The same sheet opens from Attendance → List and from Attendance → Activity → By Employee
   (open a person's panel there the usual way), for the right person each time.
7. No label in the sheet is smaller than 12 px. No console errors on open, scroll or close.

On a computer nothing changes (1440 wide, mouse):
8. The panel slides in from the right at the same width, with the initials circle, name, and the
   same order: four headline numbers, seven small numbers in one row, the arrival chart, two ring
   charts, then the Day by Day table with its eight columns.
9. Clicking the dark area beside the panel, or its ×, closes it.

When done, reply with a one-line summary per file.
