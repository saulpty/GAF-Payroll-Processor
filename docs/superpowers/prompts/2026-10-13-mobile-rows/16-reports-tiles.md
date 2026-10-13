# Phone view, Attendance → Reports: day tiles two across, tap a tile for the full day

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Reports page shows each employee's day tiles at a fixed 170 px, so only one
fits across and half the screen is empty; the tile's full wording, the form's reason and what the
small ⓘ marks mean are only shown when a mouse rests on them, which a phone cannot do; and the
Table view is a wide table that slides. This prompt, on a phone-sized screen only: shows the
Cards view only, puts the tiles two across, and opens a sheet with the whole day written out
when a tile is tapped. A computer keeps exactly what it has.

**Only these files may change.** Two new: `src/app/lib/reportDayText.ts`,
`src/app/pages/attendance/ReportDaySheet.tsx`. Three edited:
`src/app/pages/attendance/AttendanceReport.tsx`,
`src/app/pages/attendance/AttendanceReportStrips.tsx`,
`src/app/pages/attendance/AttendanceReportTable.tsx`. **No other file may be touched.**
No migration, no action file.

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
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:` or
  `max-md:`.
- `src/app/components/mobile/MobileSheet.tsx` (default export): the slide-up sheet, with
  `open`, `onClose`, `title`, `subtitle`, `size`. Its body has no padding of its own.

If `src/app/components/mobile/MobileSheet.tsx` or `src/app/lib/useIsPhone.ts` does not exist,
stop and say so. Do not write them.

No data is loaded differently: the eight loaders in `AttendanceReport.tsx` and everything that
builds the report stay exactly as they are. The sheet shows the day the tile already holds.

## 1. New file `src/app/lib/reportDayText.ts`

The sentences behind a day's small marks, in one place. The whole file:

```ts
// The words behind the small marks on a day in Attendance → Reports. The only copy: the day
// tiles' mouse-over text (computer) and the day sheet (phone) both read them from here.
// Pure: a type-only import, no Date.
import type { ReportRow } from './attendanceReportTypes';

type Flags = ReportRow['flags'];

export const FLAG_NOTE = {
  recorded:  'Recorded as an unjustified absence even though a form was filed.',
  email:     'Form submitted by a different email',
  noRequest: 'Excused in payroll, no Monday request found',
  multiple:  'Multiple forms submitted',
} as const;

/** The one note behind a tile's ⓘ: the first that applies, in this order. '' when none does. */
export function infoNote(f: Flags): string {
  if (f.recordedUnexplainedButFormOnFile) return FLAG_NOTE.recorded;
  if (f.formEmailUnrecognised) return FLAG_NOTE.email;
  if (f.excusedInPayrollNoRequest) return FLAG_NOTE.noRequest;
  return '';
}

/** Every flag on the day, written out. The phone sheet lists them all. */
export function flagNotes(f: Flags): string[] {
  const out: string[] = [];
  if (f.recordedUnexplainedButFormOnFile) out.push(FLAG_NOTE.recorded);
  if (f.formEmailUnrecognised) out.push(FLAG_NOTE.email);
  if (f.excusedInPayrollNoRequest) out.push(FLAG_NOTE.noRequest);
  if (f.multipleForms) out.push(FLAG_NOTE.multiple);
  return out;
}

/** When the form was sent, against the start of the shift. */
export const formTiming = (onTime: boolean): string =>
  (onTime ? 'Form sent before the shift' : 'Form sent after the shift');
```

## 2. New file `src/app/pages/attendance/ReportDaySheet.tsx`

The whole file:

```tsx
import type { ReactNode } from 'react';
import type { ReportRow } from '@/app/lib/attendanceReportTypes';
import { fmtDayLong } from '@/app/lib/fmtDay';
import { flagNotes, formTiming } from '@/app/lib/reportDayText';
import MobileSheet from '@/app/components/mobile/MobileSheet';
import { VERDICT_LABEL, fmtMins, time } from './AttendanceReportStrips';

type Props = { row: ReportRow | null; onClose: () => void };

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-900 break-words">{children}</dd>
    </div>
  );
}

/** Phone only: one day of Attendance → Reports written out in full. Reading only. */
export default function ReportDaySheet({ row, onClose }: Props) {
  const notes = row ? flagNotes(row.flags) : [];
  return (
    <MobileSheet
      open={row !== null}
      onClose={onClose}
      size="partial"
      title={row ? fmtDayLong(row.date) : ''}
      subtitle={row ? row.employeeName : undefined}
    >
      {row && (
        <div className="px-4 pt-1 pb-5 text-[13px] leading-5">
          <dl>
            <Line label="Verdict"><span className="font-semibold">{VERDICT_LABEL[row.verdict]}</span></Line>
            <Line label="Scheduled">{time(row.scheduledStart)}</Line>
            <Line label="In → Out"><span className="tabular-nums">{time(row.entryTime)} → {time(row.exitTime)}</span></Line>
            <Line label="Late">{row.minutesLate > 0 ? fmtMins(row.minutesLate) : '—'}</Line>
            {row.coveredBy && <Line label="Covered By">{row.coveredBy.label}</Line>}
            <Line label="Form">{row.form ? row.form.type : '—'}</Line>
            {row.form && <Line label="Sent">{formTiming(row.form.onTime)}</Line>}
            {row.form && row.form.reason && <Line label="Reason">{row.form.reason}</Line>}
          </dl>
          {notes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2 text-slate-700">
              {notes.map(n => (
                <li key={n} className="flex items-start gap-2">
                  <span className="text-slate-400" aria-hidden="true">ⓘ</span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </MobileSheet>
  );
}
```

## 3. `src/app/pages/attendance/AttendanceReportStrips.tsx`: steps 3a to 3o, nothing else

`VERDICT_TONE`, `TONE`, `VERDICT_LABEL`, `CARD_LABEL`, the tile's layout and every colour stay
exactly as they are. On a computer `onPickDay` is never given, so a tile is the same plain box as
today.

**3a.** Replace

```tsx
import { useMemo } from 'react';
```

with

```tsx
import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
```

**3b.** Directly after the line `import { fmtDuration } from '@/app/lib/teramindToday';` add:

```tsx
import { FLAG_NOTE, formTiming, infoNote } from '@/app/lib/reportDayText';
```

**3c.** Replace

```tsx
type Props = { rows: ReportRow[]; perEmployee: ReportSummary[] };
```

with

```tsx
type Props = { rows: ReportRow[]; perEmployee: ReportSummary[]; onPickDay?: (row: ReportRow) => void };
```

**3d.** (One word: `export`.) Replace

```tsx
const fmtMins = (m: number): string => (m < 60 ? `${m} min` : fmtDuration(m));
```

with

```tsx
export const fmtMins = (m: number): string => (m < 60 ? `${m} min` : fmtDuration(m));
```

**3e.** (One word: `export`.) Replace

```tsx
const time = (t: string | null) => fmtTime(t) || '—';
```

with

```tsx
export const time = (t: string | null) => fmtTime(t) || '—';
```

**3f.** Replace

```tsx
function DayTile({ row, thisYear }: { row: ReportRow; thisYear: string }) {
```

with

```tsx
/** Phone only: a tile that opens the day's sheet behaves as a button (tap, Enter, Space). */
const tappable = (go: () => void) => ({
  role: 'button', tabIndex: 0, onClick: go,
  onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } },
});

type TileProps = { row: ReportRow; thisYear: string; onPick?: (row: ReportRow) => void };

function DayTile({ row, thisYear, onPick }: TileProps) {
```

**3g.** (The tile: two across on a phone, and a button when it can be tapped.) Replace

```tsx
      className={`relative w-[170px] shrink-0 bg-white border border-slate-200 border-t-[3px] ${t.stripe} rounded-md px-2.5 pt-1.5 pb-2 shadow-card text-[11px] leading-snug`}
      title={VERDICT_LABEL[row.verdict]}
    >
```

with

```tsx
      className={`relative w-[170px] shrink-0 bg-white border border-slate-200 border-t-[3px] ${t.stripe} rounded-md px-2.5 pt-1.5 pb-2 shadow-card text-[11px] leading-snug phone:w-[calc(50%-4px)] phone:text-[12px]${onPick ? ' cursor-pointer active:bg-slate-50' : ''}`}
      title={VERDICT_LABEL[row.verdict]}
      aria-label={onPick ? `${dayStr}, ${VERDICT_LABEL[row.verdict]}. Open the day` : undefined}
      {...(onPick ? tappable(() => onPick(row)) : {})}
    >
```

**3h.** Replace

```tsx
        <span className="text-[11px] font-semibold text-slate-500">{wd}</span>
```

with

```tsx
        <span className="text-[11px] font-semibold text-slate-500 phone:text-[12px]">{wd}</span>
```

**3i.** Replace

```tsx
          <span className={`rounded-full border px-1.5 py-px text-[11px] font-semibold ${t.pill}`}>+{fmtMins(row.minutesLate)}</span>
```

with

```tsx
          <span className={`rounded-full border px-1.5 py-px text-[11px] phone:text-[12px] font-semibold ${t.pill}`}>+{fmtMins(row.minutesLate)}</span>
```

**3j.** Replace

```tsx
          <span className="text-slate-500 truncate" title={row.form.onTime ? 'Form sent before the shift' : 'Form sent after the shift'}>
```

with

```tsx
          <span className="text-slate-500 truncate" title={formTiming(row.form.onTime)}>
```

**3k.** Replace

```tsx
          <Info className="w-3 h-3 text-slate-400" title={
            row.flags.recordedUnexplainedButFormOnFile
              ? 'Recorded as an unjustified absence even though a form was filed.'
              : row.flags.formEmailUnrecognised
                ? 'Form submitted by a different email'
                : 'Excused in payroll, no Monday request found'
          } />
```

with

```tsx
          <Info className="w-3 h-3 text-slate-400" title={infoNote(row.flags)} />
```

The line above it, `{(row.flags.recordedUnexplainedButFormOnFile || row.flags.formEmailUnrecognised || row.flags.excusedInPayrollNoRequest) && (`,
stays exactly as it is.

**3l.** Replace

```tsx
          <Copy className="w-3 h-3 text-slate-400" title="Multiple forms submitted" />
```

with

```tsx
          <Copy className="w-3 h-3 text-slate-400" title={FLAG_NOTE.multiple} />
```

**3m.** Replace

```tsx
function EmployeeCard({ summary, rows, thisYear }: { summary: ReportSummary; rows: ReportRow[]; thisYear: string }) {
```

with

```tsx
function EmployeeCard({ summary, rows, thisYear, onPick }: { summary: ReportSummary; rows: ReportRow[]; thisYear: string; onPick?: (row: ReportRow) => void }) {
```

and replace

```tsx
    <div className="bg-white border border-border rounded-lg shadow-card p-4 mb-4">
```

with

```tsx
    <div className="bg-white border border-border rounded-lg shadow-card p-4 mb-4 phone:p-3">
```

and (the card's numbers go on their own line on a phone) replace

```tsx
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
```

with

```tsx
        <div className="flex items-center gap-3 text-xs text-muted-foreground phone:w-full phone:flex-wrap phone:gap-y-1">
```

**3n.** Replace

```tsx
        {sorted.map(r => <DayTile key={r.date + r.employeeId} row={r} thisYear={thisYear} />)}
```

with

```tsx
        {sorted.map(r => <DayTile key={r.date + r.employeeId} row={r} thisYear={thisYear} onPick={onPick} />)}
```

**3o.** Replace

```tsx
export function AttendanceReportStrips({ rows, perEmployee }: Props) {
```

with

```tsx
export function AttendanceReportStrips({ rows, perEmployee, onPickDay }: Props) {
```

and replace

```tsx
          thisYear={thisYear}
        />
```

with

```tsx
          thisYear={thisYear}
          onPick={onPickDay}
        />
```

## 4. `src/app/pages/attendance/AttendanceReportTable.tsx`: two edits, nothing else

So the first sentence exists once in the app. What a computer shows is the same text as today.

**4a.** Directly after the line `import { fmtDuration } from '@/app/lib/teramindToday';` add:

```tsx
import { FLAG_NOTE } from '@/app/lib/reportDayText';
```

**4b.** Replace

```tsx
                        title="Recorded as an unjustified absence even though a form was filed." />
```

with

```tsx
                        title={FLAG_NOTE.recorded} />
```

The other two `title="…"` texts in this file and `Multiple forms` stay exactly as they are.

## 5. `src/app/pages/attendance/AttendanceReport.tsx`: six edits, nothing else

**5a.** Directly after the line `import { AttendanceReportTable }  from './AttendanceReportTable';` add:

```tsx
import ReportDaySheet from './ReportDaySheet';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**5b.** Directly after the line `  const [view, setView] = useState<View>('strips');` add:

```tsx
  // A phone shows the Cards view only; tapping a day's tile opens that day in a sheet.
  const isPhone = useIsPhone();
  const [openDay, setOpenDay] = useState<ReportRow | null>(null);
  const shown: View = isPhone ? 'strips' : view;
```

**5c.** Replace

```tsx
            {/* View toggle */}
            <div className="flex justify-end mb-3">
```

with

```tsx
            {/* View toggle (not on a phone: Cards only there) */}
            {!isPhone && <div className="flex justify-end mb-3">
```

**5d.** Replace

```tsx
                </button>
              </div>
            </div>

            {/* Unmatched forms notice */}
```

with

```tsx
                </button>
              </div>
            </div>}

            {/* Unmatched forms notice */}
```

The two buttons between 5c and 5d (Cards and Table) stay exactly as they are, with the same
indentation.

**5e.** Replace

```tsx
            {rows.length > 0 && view === 'strips' && (
              <AttendanceReportStrips rows={rows} perEmployee={perEmployee} />
            )}
            {rows.length > 0 && view === 'table' && (
```

with

```tsx
            {rows.length > 0 && shown === 'strips' && (
              <AttendanceReportStrips rows={rows} perEmployee={perEmployee} onPickDay={isPhone ? setOpenDay : undefined} />
            )}
            {rows.length > 0 && shown === 'table' && (
```

**5f.** Replace

```tsx
        )}
      </div>
    </div>
  );
}
```

with

```tsx
        )}
      </div>
      {isPhone && <ReportDaySheet row={openDay} onClose={() => setOpenDay(null)} />}
    </div>
  );
}
```

The eight `useLoadAction(` calls, `liveWindow`, `liveReport`, the `useMemo` that builds the
report, `toggleCls` and `<AttendanceKpis kpis={kpis} />` stay exactly as they are.

## Known and accepted

- **A phone has no Table view.** The Cards | Table switch is not shown there, and the verdict
  filter chips, which exist only in Table view, are not added to the Cards view by this prompt.
- The sheet is for reading only: nothing in it can be changed or sent.
- On a tile the short wording may still be cut with "…" when it does not fit; the sheet shows
  it in full.
- The ten number cards at the top are not changed (they are already two across on a phone).

## Acceptance — visible facts

On a phone-sized screen (375 × 667), Attendance → Reports:
1. No `Cards | Table` switch. Each employee's card shows the name, role and manager, then on
   its own line the counts: `12 days`, `2 late`, `avg +14 min`, `92% on time`.
2. The day tiles sit two across and fill the card's width, with an 8 px gap. Nothing on a tile
   is smaller than 12 px.
3. Tap a tile: a sheet slides up titled with the full date (`Monday, October 5, 2026`) and the
   employee's name under it. It lists Verdict (the full wording, for example
   `Late — Form Sent After Shift`), Scheduled, In → Out, Late, and Form. When there is a form it
   also says `Form sent before the shift` or `Form sent after the shift`, and the reason text
   when the form has one.
4. A tile with a small ⓘ or copy mark: its sheet writes each one out as a sentence at the
   bottom (`Form submitted by a different email`, `Multiple forms submitted`, …).
5. The × closes the sheet; the page has not moved. Tapping another tile opens that day.
6. Sideways (667 × 375): still two tiles across; the sheet fits the screen and scrolls inside.
7. No console errors on load or after each tap.

On a computer nothing changes (1440 wide, mouse):
8. The `Cards | Table` switch is there and both views work as before, including the Table
   view's filter chips and sorting.
9. Tiles are 170 px wide with 11 px text; clicking a tile does nothing; resting the mouse on a
   tile, on a form mark, on an ⓘ or on the copy mark shows the same words as before.

When done, reply with a one-line summary per file.
