# Phone view, rows 1: the shared phone row, and Attendance → Today as rows

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today, Attendance → Today is the computer's ten-column table squeezed into the screen:
you slide it sideways to read one person, the nine count boxes fill the first screen, and the
"Live" bar stays pinned at the top and eats a fifth of the height. This prompt adds the one row
every phone list will use (`MobileRow`), and uses it on Today: one row per person (name, status,
why or shift, when they came in, how late), the counts on one sliding line, and a header that
scrolls away with the page. On a computer nothing changes.

**Only these files may change.** Three new: `src/app/components/mobile/MobileRow.tsx`,
`src/app/lib/todayRows.ts`, `src/app/pages/attendance/TodayRows.tsx`. Three edited:
`src/app/pages/attendance/AttendanceToday.tsx`, `src/app/pages/attendance/TodayTiles.tsx`,
`src/DESIGN.md`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the six listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:`,
  `max-md:` or any other variant.
- `src/index.css` has the class `no-scrollbar`.
- `src/app/pages/attendance/TodayRow.tsx` exports `STATUS_CHIP` and `isOnLeave`;
  `src/app/pages/attendance/activity/WhyChipBadge.tsx` is the Why chip. They are imported below,
  not copied, and **not edited**.

`src/app/pages/attendance/TodayTable.tsx` and `TodayRow.tsx` must stay exactly as they are, byte
for byte. No new loader: the rows are built from the data the table already has.

If `src/app/lib/useIsPhone.ts` does not exist, stop and say so. Do not write it.

## 1. New file `src/app/components/mobile/MobileRow.tsx` — the whole file

```tsx
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  /** Line 1, left: the name. Wraps onto a second line; never cut off. */
  title: ReactNode;
  /** Small line under the title (role, position). */
  sub?: ReactNode;
  /** Line 1, pinned right: one status pill or one headline number. */
  right?: ReactNode;
  /** Line 2: up to three facts. */
  facts?: ReactNode;
  /** Whole-row wash for a flagged row, as on the computer. */
  tone?: 'none' | 'green' | 'yellow' | 'red';
  /** Day off, inactive, closed: muted text (never see-through). */
  muted?: boolean;
  /** down / up = opens in place (reading only). right = opens a sheet. */
  chevron?: 'none' | 'down' | 'up' | 'right';
  /** When given, the row is a real button. */
  onClick?: () => void;
  /** For rows that open in place. */
  expanded?: boolean;
  /** Name for screen readers when the title is not plain text. */
  label?: string;
  /** The opened-in-place detail, shown under the row. */
  children?: ReactNode;
};

const TONE = {
  none: 'bg-white',
  green: 'bg-status-green-tint',
  yellow: 'bg-status-yellow-tint',
  red: 'bg-status-red-tint',
} as const;

const CHEVRON = { down: ChevronDown, up: ChevronUp, right: ChevronRight } as const;

/** One row of a phone list: flat, full width, a hairline under it. See DESIGN.md, "Phone". */
export default function MobileRow({
  title, sub, right, facts, tone = 'none', muted = false, chevron = 'none', onClick, expanded, label, children,
}: Props) {
  const Icon = chevron === 'none' ? null : CHEVRON[chevron];
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className={cn('block text-[14px] font-semibold leading-5 break-words', muted ? 'text-slate-500' : 'text-slate-900')}>
            {title}
          </span>
          {sub && <span className="block text-[12px] leading-4 text-slate-500 break-words">{sub}</span>}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {right}
          {Icon && <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />}
        </span>
      </span>
      {facts && (
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-slate-500 tabular-nums">
          {facts}
        </span>
      )}
    </>
  );
  const box = cn('block w-full min-h-[60px] px-4 py-3 text-left', TONE[tone]);
  return (
    <div className="border-b border-slate-200">
      {onClick ? (
        <button
          type="button" onClick={onClick} aria-expanded={expanded} aria-label={label}
          className={cn(box, 'active:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-warm-ring')}
        >
          {body}
        </button>
      ) : (
        <div className={box}>{body}</div>
      )}
      {children}
    </div>
  );
}
```

Every later phone list relies on this exact file. Do not rename a prop, reorder anything or add
a feature.

## 2. New file `src/app/lib/todayRows.ts` — the whole file

```ts
// What a phone row on Attendance → Today shows. Pure: type-only imports, no clock, no React.
// These are the same rules TodayRow.tsx applies to the table on a computer, kept here so the
// phone rows can be tested without a browser (tests/mobileToday.test.ts).
import type { TodayRow, TodayStatus } from './teramindToday';

export type TodayTone = 'none' | 'yellow' | 'red';

/**
 * The wash behind a phone row, matching the colour of its status pill: red for No Records that
 * nothing explains, yellow for Away. A person on leave (a form or a holiday covers the day) is
 * not flagged, and neither is anyone else.
 */
export function todayTone(status: TodayStatus, onLeave: boolean): TodayTone {
  if (status === 'late_not_in' && !onLeave) return 'red';
  if (status === 'away') return 'yellow';
  return 'none';
}

/** Off today and nothing recorded: the row the table greys out. Worked on a day off: not muted. */
export function isOffToday(row: Pick<TodayRow, 'status' | 'records'>): boolean {
  return row.status === 'day_off' && row.records === 0;
}

export type TodayLate = { minutes: number; level: 'on_time' | 'grace' | 'late' };

/**
 * How late the person came in. null = no entry yet (nothing to say). `grace` = after the shift
 * started but inside the grace period (amber on the table); `late` = after it (red).
 */
export function todayLate(row: Pick<TodayRow, 'entryMin' | 'minutesLate' | 'lateAfterGrace'>): TodayLate | null {
  if (row.entryMin === null) return null;
  if (row.minutesLate === 0) return { minutes: 0, level: 'on_time' };
  return { minutes: row.minutesLate, level: row.lateAfterGrace ? 'late' : 'grace' };
}

/** The nothing-found line: it names every filter that is switched on, in the filter bar's words. */
export function todayNothingFound(f: { employee?: string; manager?: string; role?: string }): string {
  const parts: string[] = [];
  const employee = (f.employee ?? '').trim();
  if (employee) parts.push(`Employee: ${employee}`);
  if (f.manager) parts.push(`Manager: ${f.manager}`);
  if (f.role) parts.push(`Title: ${f.role}`);
  return parts.length ? `No employees match ${parts.join(' · ')}` : 'No employees to show.';
}
```

The only import is `import type`. Keep it that way: the tests load this file directly.

## 3. New file `src/app/pages/attendance/TodayRows.tsx` — the whole file

```tsx
import MobileRow from '@/app/components/mobile/MobileRow';
import { fmtClock, fmtDuration } from '@/app/lib/teramindToday';
import type { TodayRow } from '@/app/lib/teramindToday';
import { fmtTime } from '@/app/lib/fmtTime';
import type { WhyChip } from '@/app/lib/activityDays';
import { isOffToday, todayLate, todayTone } from '@/app/lib/todayRows';
import WhyChipBadge from './activity/WhyChipBadge';
import { STATUS_CHIP, isOnLeave } from './TodayRow';

// The Today board on a phone: one row per employee, built from the same row objects, in the same
// order, as TodayTable. The page renders this OR the table, never both. Status colours and the
// On Leave rule are imported from TodayRow.tsx; the formats below are the table's own.
const ON_LEAVE = { label: 'On Leave', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
const LATE_CLS = { on_time: '', grace: 'text-amber-700 font-medium', late: 'text-status-red-ink font-semibold' } as const;
const clock = (min: number) => fmtTime(fmtClock(min));
const lateBy = (m: number) => (m < 60 ? `+${m} min` : `+${fmtDuration(m)}`);

/** Grey placeholder rows at the real row height, shown while the first load is running. */
export function TodayRowsLoading() {
  return (
    <div className="-mx-4 bg-white border-t border-slate-200" role="status" aria-label="Loading attendance data">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse px-4 py-3">
          <div className="h-3.5 w-40 rounded bg-slate-200" />
          <div className="mt-2.5 h-3 w-56 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function TodayRows({
  rows, whyById, whyLoading, ghostByEmployee, onRowClick,
}: {
  rows: TodayRow[];
  whyById: Map<number, WhyChip | null>;
  whyLoading: boolean;
  ghostByEmployee: Map<number, number>;
  onRowClick?: (row: TodayRow) => void;
}) {
  // -mx-4: on a phone the page area has 16 px of side padding; the rows run edge to edge.
  return (
    <div className="-mx-4 bg-white border-t border-slate-200">
      {rows.map(row => {
        const why = whyLoading ? undefined : (whyById.get(row.employeeId) ?? null);
        const onLeave = isOnLeave(row.status, why);
        const chip = onLeave ? ON_LEAVE : STATUS_CHIP[row.status];
        const chipLabel = !onLeave && row.status === 'holiday' && row.holidayName ? row.holidayName : chip.label;
        const shift = row.scheduledStartMin !== null && row.scheduledEndMin !== null
          ? `${clock(row.scheduledStartMin)}–${clock(row.scheduledEndMin)}`
          : '';
        const late = todayLate(row);
        const ghostMin = ghostByEmployee.get(row.employeeId);
        const hasFacts = !!why || shift !== '' || row.entryMin !== null || ghostMin !== undefined;
        return (
          <MobileRow
            key={row.employeeId}
            title={row.name}
            right={(
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium border ${chip.cls}`}>
                {chipLabel}
              </span>
            )}
            facts={hasFacts ? (
              <>
                {why ? <WhyChipBadge chip={why} /> : shift !== '' && <span>{shift}</span>}
                {row.entryMin !== null && <span>In {clock(row.entryMin)}</span>}
                {late && (
                  <span className={LATE_CLS[late.level]}>
                    {late.level === 'on_time' ? 'On time' : lateBy(late.minutes)}
                  </span>
                )}
                {ghostMin !== undefined && <span className="text-[12px]">Early Record {fmtClock(ghostMin)} Ignored</span>}
              </>
            ) : undefined}
            tone={todayTone(row.status, onLeave)}
            muted={isOffToday(row)}
            chevron="right"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          />
        );
      })}
    </div>
  );
}
```

## 4. `src/app/pages/attendance/AttendanceToday.tsx`: steps 4a to 4l, nothing else

Every loader, every `useMemo`, the 60-second refresh, the counts and the `<AttendancePanel …/>`
block at the bottom stay exactly as they are. `useIsPhone()` is called once, here, and nowhere
else in these files.

**4a.** Directly after the line `import TodayTable from './TodayTable';` add:

```tsx
import TodayRows, { TodayRowsLoading } from './TodayRows';
import { useIsPhone } from '@/app/lib/useIsPhone';
import { todayNothingFound } from '@/app/lib/todayRows';
```

**4b.** Directly after the line `  const { viewAs } = useViewer();` add:

```tsx
  const isPhone = useIsPhone();
```

**4c.** The page's outer box. Replace

```tsx
    <div className="flex flex-col h-full bg-background">
```

with

```tsx
    <div className="flex flex-col h-full bg-background phone:h-auto phone:min-h-full">
```

**4d.** The header bar. Replace

```tsx
      <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3">
```

with

```tsx
      <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3 phone:px-4">
```

**4e.** On a phone the long sentence moves into the ⓘ. Replace

```tsx
        <InfoTip text="Teramind data syncs every 5 minutes. The time shown is the latest sync received." />
        <span className="text-slate-500 text-[13px]">
          Data as of {dataAsOf} · updates every 5 minutes · times in US Eastern
        </span>
```

with

```tsx
        <InfoTip text={isPhone
          ? 'Teramind data syncs every 5 minutes. The time shown is the latest sync received. Times are in US Eastern.'
          : 'Teramind data syncs every 5 minutes. The time shown is the latest sync received.'} />
        <span className="text-slate-500 text-[13px]">
          {isPhone ? <>Data as of {dataAsOf}</> : <>Data as of {dataAsOf} · updates every 5 minutes · times in US Eastern</>}
        </span>
```

**4f.** The date box. Replace

```tsx
            className="h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring"
```

with

```tsx
            className="h-8 px-2.5 text-[13px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-warm-ring phone:h-11"
```

**4g.** The Today button. Replace

```tsx
              className="h-8 px-3 text-[13px] rounded-md bg-warm text-warm-ink font-semibold hover:brightness-95 transition"
```

with

```tsx
              className="h-8 px-3 text-[13px] rounded-md bg-warm text-warm-ink font-semibold hover:brightness-95 transition phone:h-11"
```

**4h.** The old-data notice. Replace

```tsx
        <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
```

with

```tsx
        <div className="shrink-0 px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 phone:px-4">
```

**4i.** The page area. On a computer it is the part that scrolls, under a header that stays put.
On a phone it stops scrolling by itself, so the whole page (header included) scrolls as one.
Replace

```tsx
      <div className="flex-1 overflow-auto px-5 py-4">
```

with

```tsx
      <div className="flex-1 overflow-auto px-5 py-4 phone:flex-none phone:overflow-visible phone:px-4 phone:py-3">
```

**4j.** Loading. Replace

```tsx
        {loading && rows.length === 0 && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
```

with

```tsx
        {loading && rows.length === 0 && isPhone && <TodayRowsLoading />}
        {loading && rows.length === 0 && !isPhone && (
          <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
```

**4k.** Nothing found. Replace

```tsx
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            No employees match these filters.
          </div>
```

with

```tsx
          <div className="flex items-center justify-center py-24 text-muted-foreground text-sm phone:py-10 phone:text-center">
            {isPhone ? todayNothingFound({ employee: globalEmployee, manager, role }) : 'No employees match these filters.'}
          </div>
```

**4l.** Rows on a phone, the table on a computer: one or the other, never both. Replace

```tsx
            <TodayTable rows={rows} isToday={isToday} whyById={whyById} whyLoading={whyLoading} ghostByEmployee={ghostByEmployee} onRowClick={setPanelRow} />
```

with

```tsx
            {isPhone
              ? <TodayRows rows={rows} whyById={whyById} whyLoading={whyLoading} ghostByEmployee={ghostByEmployee} onRowClick={setPanelRow} />
              : <TodayTable rows={rows} isToday={isToday} whyById={whyById} whyLoading={whyLoading} ghostByEmployee={ghostByEmployee} onRowClick={setPanelRow} />}
```

The two amber and red "Couldn't refresh" / "Couldn't load" boxes stay exactly as they are and show
on a phone too.

## 5. `src/app/pages/attendance/TodayTiles.tsx`: four edits, class strings only

The same nine counts, in the same order, each with its ⓘ. On a phone they sit on one line that
slides sideways instead of nine boxes. No tile is added, removed or reordered.

**5a.** In `TodayTiles` (the box around the tiles), replace

```tsx
    <div className="flex flex-wrap gap-2 mb-4">
```

with

```tsx
    <div className="flex flex-wrap gap-2 mb-4 no-scrollbar phone:-mx-4 phone:mb-2 phone:h-10 phone:flex-nowrap phone:items-center phone:gap-4 phone:overflow-x-auto phone:px-4">
```

**5b.** In `SummaryTile` (one tile), replace

```tsx
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[104px] shadow-card">
```

with

```tsx
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex flex-col gap-0.5 min-w-[104px] shadow-card phone:min-w-0 phone:shrink-0 phone:flex-row phone:items-center phone:gap-1.5 phone:rounded-none phone:border-0 phone:bg-transparent phone:p-0 phone:shadow-none">
```

**5c.** The number. Replace

```tsx
      <span className={`text-[22px] leading-7 font-bold tabular-nums ${accent ?? 'text-slate-900'}`}>{value}</span>
```

with

```tsx
      <span className={`text-[22px] leading-7 font-bold tabular-nums phone:text-[13px] phone:leading-5 ${accent ?? 'text-slate-900'}`}>{value}</span>
```

**5d.** The label. Replace

```tsx
      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap">
```

with

```tsx
      <span className="text-[12px] text-slate-600 font-medium flex items-center gap-1.5 whitespace-nowrap phone:text-[13px]">
```

Every `<SummaryTile … />` line, every `tip`, and the `isToday` / `offTodayCount` conditions stay
exactly as they are.

## 6. `src/DESIGN.md`: one addition at the very end, nothing else

Every existing line of this file stays exactly as it is, byte for byte. Add the section below
after the last line of the file (the last line of the Accessibility section), with one blank
line before it:

```md
## Phone

Everything above still holds on a phone; this section adds what a small touch screen needs. The
app is still a spreadsheet: on a phone it is a spreadsheet one column wide, not a set of cards.

**Two switches, never mixed up.**
- *Phone-sized screen* (layout): the `phone` Tailwind screen and `useIsPhone()`, one shared query
  (`(max-width: 767px), (max-height: 500px) and (pointer: coarse)`). Styling differences use
  `phone:` classes; a different structure uses the hook so only one layout is rendered.
- *Touch screen* (comfort, any width): `@media (pointer: coarse)` in `src/index.css`.
  A desktop with a mouse matches neither and must not change.

**Frame.** Top bar 48 · one 44 px row for tabs or active-filter chips plus the Filters button ·
page · section bar 56. Nothing in the frame is `position: fixed`. Page headers scroll with the page.
Section order and names are the same as on the computer.

**Touch.** Anything tappable has a hit area of at least 44 × 44 px (the visible shape may be
smaller). Text boxes are 16 px on touch screens. Nothing depends on hover: whatever a `title` says
is written out where the person taps. No swipe gestures.

**Type on a phone.** Name / row title 14 px semibold. Row facts 13 px. Labels and pills 12 px.
Nothing below 12 px. Numbers tabular. The one headline number on a row (PTO Available) 20 px bold.

**Rows, not cards (`MobileRow`).** Full width, flat, separated by a 1 px `border` hairline; no
gaps, shadows or rounded boxes between rows; 12 px vertical and 16 px side padding; about 60 px
tall. Line 1: name (wraps to two lines, never "…") and, pinned right, one status pill. Line 2: up
to three facts in `muted-foreground`. A flagged row gets the matching `-tint` wash, as on desktop.
Dimmed rows (day off, inactive) use the muted text colour, never opacity. A row that opens
something is a real button with a pressed state.

**Opening detail.** Down-chevron: opens in place, reading only. Right-chevron: opens a sheet,
for long detail or anything with buttons. At most two layers over a page (a sheet, then one dialog).

**Sheets (`MobileSheet`).** Built on the existing dialog. Full width, top corners `lg` (8 px),
title bar stays while the body scrolls, close button top right. Dialogs on a phone: 16 px side
margin, never taller than the screen, scroll inside, one-column forms, buttons full width.

**Colour.** Section names and active labels on white use the section's `ink` colour, never its
`accent` (Contracts accent on white is 3.2:1). Only truly destructive actions are red (Delete);
Close Case is an ordinary button.

**Sliding lines.** Tabs, filter chips and count strips that do not fit sit on one line that slides
sideways, with a fade on the edge where more is hidden. They never wrap into a block.

**States.** Every phone list has grey placeholder rows while loading, a nothing-found line that
names the active filter, and the error message with a full-width Retry.

**Payroll and Admin** are not redesigned for phones: they keep the computer layout inside
`DesktopCanvas` and slide.
```

## Acceptance — visible facts

On a phone-sized screen (375 × 667), Attendance → Today:
1. No table. One row per person: the name on the left in bold, the status pill on the right with
   a small arrow after it; under the name the Why chip when there is one, otherwise the shift
   (`9AM–5PM`); then `In 9:05AM` and `On time` or `+12 min` for anyone who has come in.
2. The people are in the same order as the computer's table (No Records first, day off last), and
   each person's pill reads the same as on the computer (including `On Leave` and a holiday's name).
3. No Records rows (not on leave) have a pale red background; Away rows a pale yellow one; all
   others are white. Someone off today with nothing recorded is in grey text, fully readable.
4. A long name wraps onto a second line; the pill stays at the right; nothing ends in "…".
5. The nine counts are one line, about 40 px tall, that slides sideways: `42 Scheduled`,
   `37 Working`, … The numbers equal the computer's tiles. Tapping an ⓘ shows its text.
6. The header reads `Live ⓘ Data as of 9:05 AM`; the ⓘ text ends with "Times are in US Eastern."
   The date box and the Today button are 44 px tall.
7. Scrolling the page moves the header away with it. Nothing stays pinned over the rows, and only
   one thing scrolls up and down.
8. At least four people are visible without scrolling.
9. Tapping a row opens that person's panel: the same panel, for the same person, as clicking
   their row on the computer.
10. While the page first loads: five grey placeholder rows, not a blank page. With a filter that
    matches nobody: one centred line that names it, such as `No employees match Title: Intake 1`.
11. Sideways (667 × 375) it is the same layout. No console errors on load or after a tap.

On a computer nothing changes (1440 wide, mouse):
12. The same table with the same ten columns; clicking a row opens the panel.
13. The same nine tiles, the same size and colours.
14. The header reads `Data as of … · updates every 5 minutes · times in US Eastern` and stays put
    while the table area scrolls under it.
15. Loading shows "Loading attendance data…"; no match shows "No employees match these filters."

When done, reply with a one-line summary per file.
