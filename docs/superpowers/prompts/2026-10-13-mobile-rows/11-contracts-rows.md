# Phone view, rows 4: Contracts

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Contracts page is a ten-column table you slide sideways, and four things can
only be read by hovering with a mouse: the date a milestone was reached, the board's start date
when it differs from the roster's, and the sentence that explains "Pending Review" or "Not
Renewed". This prompt gives the phone one row per employee instead (name, position, the Contract
End pill, the next milestone), which opens in place to show everything the table holds, written
out. The summary chips become one line that slides sideways. The computer keeps the table exactly
as it is.

**Only these files may change.** One new: `src/app/pages/contracts/ContractRows.tsx`. Three
edited: `src/app/pages/contracts/ContractsTable.tsx`, `src/app/pages/contracts/ContractsChips.tsx`,
`src/app/lib/contractChips.ts`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the four listed above. No other file may be touched. No action file, no migration.
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
- `src/app/components/mobile/MobileRow.tsx` (default export): the one row every phone list uses.
- `src/app/pages/contracts/ContractCells.tsx` and `ContractRow.tsx` draw the table's cells. They
  are **not** edited by this prompt.

If `src/app/components/mobile/MobileRow.tsx` or `src/app/lib/useIsPhone.ts` does not exist, stop
and say so. Do not write either of them.

This prompt adds no loader, no action and no query. The rows are drawn from the list the table
already has.

## 1. `src/app/lib/contractChips.ts`: one addition at the very end, nothing else

Every existing line of this file stays exactly as it is, byte for byte. The file must keep having
no import other than the one `import type` line it has today. After the closing `}` of
`tenureDisplay` (after the last line of the file) add a blank line and then:

```ts
// ── Phone rows (2026-10-13) ──────────────────────────────────────────────────────────────────
// The words the phone rows show. The same rules as the table cells in
// pages/contracts/ContractCells.tsx, as plain values, so the rows and the table cannot disagree
// (tests/mobileContracts.test.ts checks these against that file). Dates arrive already
// formatted, or with the formatter passed in: this file still has no clock and no Date.

export const MILESTONE_LABELS: Record<string, string> = {
  '1m': '1 Month', '3m': '3 Months', '6m': '6 Months', '1y': '1 Year', '2y': '2 Years',
};

export interface MilestoneLine {
  key: string;
  label: string;
  date: string;
  /** done = already reached; next = the one coming up; later = after the next one. */
  state: 'done' | 'next' | 'later';
  /** Days until it. Only the next one has a number. */
  days: number | null;
  /** The next one, 14 days away or less (the table's yellow box). */
  soon: boolean;
}

/** The five milestones with their state, decided exactly as MilestoneCells decides it. */
export function milestoneLines(
  ms: { key: string; date: string }[] | null,
  next: { key: string; date: string; days: number } | null,
): MilestoneLine[] {
  if (!ms) return [];
  return ms.map(m => {
    const isNext = next !== null && next.key === m.key;
    const isPast = next !== null ? m.date < next.date : true;
    return {
      key: m.key,
      label: MILESTONE_LABELS[m.key] ?? m.key,
      date: m.date,
      state: isNext ? 'next' : isPast ? 'done' : 'later',
      days: isNext ? next.days : null,
      soon: isNext && next.days <= SOON_DAYS,
    };
  });
}

/**
 * The next milestone in words: "6 Months · Mon Oct 19 · in 7 days". `lead` and `when` are the two
 * halves, so the row can emphasise the last part. null when all five have passed or there is no
 * start date.
 */
export function nextMilestoneLine(
  next: { key: string; date: string; days: number } | null,
  fmt: (ymd: string) => string,
): { lead: string; when: string; soon: boolean; text: string } | null {
  if (!next) return null;
  const lead = `${MILESTONE_LABELS[next.key] ?? next.key} · ${fmt(next.date)}`;
  const when = inDaysLabel(next.days);
  return { lead, when, soon: next.days <= SOON_DAYS, text: `${lead} · ${when}` };
}

export type EndTone = 'none' | 'green' | 'yellow' | 'red';

/** The fields the Contract End pill reads; ContractRowData satisfies this. */
export interface EndRow extends ChipRow {
  has_board_row: boolean;
  end: string | null;
}

export interface ContractEndView {
  /** The pill's words. With tone 'none' it is a plain date (more than 60 days away), not a pill. */
  pill: string;
  tone: EndTone;
  /** A second pill under the first: the board's decision on a contract that has not ended yet. */
  second: { text: string; tone: EndTone } | null;
  /** The small grey line under the pill ("ended Mon Oct 5"), or ''. */
  note: string;
  /** The sentence the table only shows on hover, or ''. */
  explain: string;
  /** Whole-row wash on the phone: red = ends within 30 days; yellow = within 60, or pending review. */
  wash: 'none' | 'yellow' | 'red';
}

/**
 * What the Contract End cell says, as values. `day` is the end date already formatted with
 * fmtDay. null = the table's dash (not on the board, or no end date).
 */
export function contractEndView(row: EndRow, day: string): ContractEndView | null {
  const { end, endState, renewal } = row;
  if (!row.has_board_row || endState.kind === 'none' || !end) return null;

  if (endState.kind === 'ended') {
    if (renewal === 'renewed') {
      return {
        pill: `Renewed · was ${day}`, tone: 'green', second: null, note: '',
        explain: `Board status Passed. Fixed term ended on ${day}.`, wash: 'none',
      };
    }
    if (renewal === 'not_renewed') {
      return {
        pill: 'Not Renewed', tone: 'red', second: null, note: `ended ${day}`,
        explain: 'Board status Failed — still on the active roster.', wash: 'none',
      };
    }
    return {
      pill: 'Pending Review', tone: 'yellow', second: null, note: `ended ${day}`,
      explain: 'Fixed term ended and the board has no renewal decision yet.', wash: 'yellow',
    };
  }

  // future
  const days = endState.days ?? 0;
  const tone: EndTone = days <= 30 ? 'red' : days <= 60 ? 'yellow' : 'none';
  const second: ContractEndView['second'] =
    renewal === 'renewed' ? { text: 'Renewed', tone: 'green' }
    : renewal === 'not_renewed' ? { text: 'Not Renewed', tone: 'red' }
    : null;
  return {
    pill: tone === 'none' ? day : `${day} · ${inDaysLabel(days)}`,
    tone, second, note: '', explain: '',
    wash: tone === 'red' ? 'red' : tone === 'yellow' ? 'yellow' : 'none',
  };
}

/** The one line an empty phone list shows; it names whatever is narrowing the list. */
export function noMatchLine(
  chipLabel: string | null,
  f: { employee?: string; role?: string; manager?: string },
): string {
  const parts: string[] = [];
  if (chipLabel) parts.push(chipLabel);
  if (f.employee) parts.push(`Employee: ${f.employee}`);
  if (f.manager) parts.push(`Manager: ${f.manager}`);
  if (f.role) parts.push(`Title: ${f.role}`);
  return parts.length === 0 ? 'No employees to show.' : `No employees match ${parts.join(' · ')}`;
}
```

## 2. New file `src/app/pages/contracts/ContractRows.tsx`

The whole file:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import MobileRow from '@/app/components/mobile/MobileRow';
import { fmtDay } from '@/app/lib/fmtDay';
import {
  contractEndView, inDaysLabel, milestoneLines, nextMilestoneLine, noMatchLine, tenureDisplay,
} from '@/app/lib/contractChips';
import type { ContractChip, ContractEndView, EndTone } from '@/app/lib/contractChips';
import type { ContractRowData } from './ContractRow';
import { CHIPS } from './ContractsChips';

// Contracts on a phone (2026-10-13): one MobileRow per employee instead of the table.
// ContractsTable renders this only when useIsPhone() is true, from the same sorted and filtered
// list the table gets. Reading only: no loader, no action. Everything the table says in a hover
// title is written out in the opened row. The words and colours come from contractChips.ts.

interface Props {
  rows: ContractRowData[];
  thisYear: string;
  chip: ContractChip | null;
  employee: string;
  role: string;
  manager: string;
}

const PILL = 'inline-flex items-center rounded-full px-2 py-px text-[12px] font-semibold whitespace-nowrap';
const FILL: Record<EndTone, string> = {
  none: 'bg-slate-100 text-slate-700',
  green: 'bg-status-green-fill text-status-green-ink',
  yellow: 'bg-status-yellow-fill text-status-yellow-ink',
  red: 'bg-status-red-fill text-status-red-ink',
};
const DASH = <span className="text-slate-400">—</span>;

/** Grey placeholder rows at the real row height, shown while the list loads. */
export function ContractRowsLoading() {
  return (
    <div className="shrink-0 bg-white border-t border-slate-200" role="status" aria-label="Loading contracts">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className="h-[60px] border-b border-slate-200 bg-white animate-pulse" />
      ))}
    </div>
  );
}

/** The Contract End pill, stacked as in the table: pill, then the decision or "ended …". */
function EndPills({ end, plainLead }: { end: ContractEndView; plainLead: string }) {
  return (
    <span className="flex flex-col items-end gap-0.5">
      {end.tone === 'none' ? (
        <span className="text-[12px] text-slate-600 tabular-nums whitespace-nowrap">{plainLead}{end.pill}</span>
      ) : (
        <span className={cn(PILL, FILL[end.tone])}>{end.pill}</span>
      )}
      {end.second && <span className={cn(PILL, FILL[end.second.tone])}>{end.second.text}</span>}
      {end.note && <span className="text-[12px] text-slate-500 whitespace-nowrap">{end.note}</span>}
    </span>
  );
}

function Line({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-slate-500">{label}</span>
        <span className="min-w-0 text-right text-slate-900 tabular-nums">{children}</span>
      </div>
      {hint && <p className="mt-0.5 text-[12px] leading-4 text-slate-500">{hint}</p>}
    </div>
  );
}

/** The opened row: all five milestones, tenure, start date, state, contract end, in words. */
function Detail({ row, thisYear, end }: { row: ContractRowData; thisYear: string; end: ContractEndView | null }) {
  const lines = milestoneLines(row.ms, row.next);
  return (
    <div className="bg-slate-50 px-4 py-3 text-[13px] leading-5 text-slate-700">
      <div className="text-[12px] font-semibold text-slate-500">Milestones</div>
      {lines.length === 0 && (
        <p className="py-1.5 text-slate-500">No start date on the roster, so no milestones can be worked out.</p>
      )}
      {lines.map(m => (
        <Line key={m.key} label={m.label}>
          {m.state === 'done' && (
            <span className="inline-flex items-center gap-1 font-medium text-status-green-ink">
              <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={2.4} aria-hidden="true" />
              Done · {fmtDay(m.date, thisYear)}
            </span>
          )}
          {m.state === 'next' && (
            <span className="font-semibold">
              {fmtDay(m.date, thisYear)}{' '}
              <span className={cn('rounded px-1.5 py-px', m.soon ? 'bg-status-yellow-fill text-status-yellow-ink' : 'bg-warm-tint text-warm-text')}>
                {inDaysLabel(m.days ?? 0)}
              </span>
            </span>
          )}
          {m.state === 'later' && <span className="text-slate-500">{fmtDay(m.date, thisYear)}</span>}
        </Line>
      ))}

      <div className="mt-2 border-t border-slate-200 pt-2">
        <Line label="Tenure">{row.tenure ? tenureDisplay(row.tenure) : DASH}</Line>
        <Line label="Start Date">
          {row.start ? fmtDay(row.start, thisYear) : <span className={cn(PILL, FILL.yellow)}>No Start Date</span>}
        </Line>
        {row.start && row.startMismatch && (
          <Line
            label="Board Start Date"
            hint="The Onboarding board has a different start date from the roster. Tenure and milestones use the roster's."
          >
            <span className="text-status-yellow-ink">
              <span aria-hidden="true">⚠ </span>{fmtDay(row.board_start, thisYear)}
            </span>
          </Line>
        )}
        <Line label="State" hint="Region or operating entity from the Onboarding board, not employment status.">
          {row.has_board_row ? (row.state || DASH) : DASH}
        </Line>
        <Line label="Contract End" hint={end?.explain || undefined}>
          {end ? <EndPills end={end} plainLead="" /> : DASH}
        </Line>
        {!row.has_board_row && (
          <p className="py-1.5 text-[12px] leading-4 text-slate-500">
            Not on the Onboarding board, so there is no position, state or contract end date to show.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ContractRows({ rows, thisYear, chip, employee, role, manager }: Props) {
  // Which rows are open. Several can be open at once, so closing one never moves another.
  const [open, setOpen] = useState<Record<number, boolean>>({});

  if (rows.length === 0) {
    const chipLabel = chip ? CHIPS.find(c => c.key === chip)?.label ?? null : null;
    return (
      <div className="shrink-0 px-4 py-8 text-center text-[13px] leading-5 text-slate-500">
        <p>{noMatchLine(chipLabel, { employee, role, manager })}</p>
        {chip && <p className="mt-1 text-[12px]">Tap the highlighted chip again to clear it.</p>}
      </div>
    );
  }

  return (
    <div className="shrink-0 mb-6 bg-white border-t border-slate-200">
      {rows.map(row => {
        const isOpen = !!open[row.employee_id];
        const position = row.has_board_row ? row.position : null;
        const end = contractEndView(row, fmtDay(row.end, thisYear));
        const next = nextMilestoneLine(row.next, d => fmtDay(d, thisYear));
        return (
          <MobileRow
            key={row.employee_id}
            title={row.display_name}
            sub={(position || !row.has_board_row) ? (
              <>
                {position}
                {!row.has_board_row && (
                  <span className={cn(PILL, FILL.none, 'mt-0.5 font-medium')}>Not on Onboarding Board</span>
                )}
              </>
            ) : undefined}
            right={end ? <EndPills end={end} plainLead="Ends " /> : undefined}
            facts={next ? (
              <span>
                {next.lead} ·{' '}
                <span className={cn('rounded px-1.5 py-px font-semibold', next.soon ? 'bg-status-yellow-fill text-status-yellow-ink' : 'bg-warm-tint text-warm-text')}>
                  {next.when}
                </span>
              </span>
            ) : row.ms ? (
              <span>All five milestones reached</span>
            ) : (
              <span className={cn(PILL, FILL.yellow)}>No Start Date</span>
            )}
            tone={end?.wash ?? 'none'}
            chevron={isOpen ? 'up' : 'down'}
            expanded={isOpen}
            onClick={() => setOpen(prev => ({ ...prev, [row.employee_id]: !prev[row.employee_id] }))}
          >
            {isOpen && <Detail row={row} thisYear={thisYear} end={end} />}
          </MobileRow>
        );
      })}
    </div>
  );
}
```

## 3. `src/app/pages/contracts/ContractsChips.tsx`: four edits, nothing else

**3a.** Replace

```tsx
const CHIPS: { key: ContractChip; label: string; dot: string; tip: string }[] = [
```

with

```tsx
export const CHIPS: { key: ContractChip; label: string; dot: string; tip: string }[] = [
```

The four entries under it stay exactly as they are.

**3b.** Replace

```tsx
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`;
```

with

```tsx
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-warm-ring phone:relative phone:shrink-0 phone:before:absolute phone:before:inset-x-0 phone:before:-inset-y-3 phone:before:content-[''] ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'}`;
```

(On a phone each chip keeps its pill shape, 24 px tall, and gets an invisible area 11 px above and
below it, so the part a finger can hit is 46 px tall.)

**3c.** Replace

```tsx
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
```

with

```tsx
    <div className="flex flex-wrap items-center gap-2 px-6 pb-3 no-scrollbar phone:flex-nowrap phone:overflow-x-auto phone:px-4 phone:-mt-3 phone:pt-3">
```

(One line that slides sideways. The 12 px of room above the chips is what the taller hit area
sits in; the negative margin takes the same 12 px back, so nothing moves down.)

**3d.** Replace

```tsx
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-primary">
```

with

```tsx
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-primary phone:shrink-0">
```

The `<button>` (its `type`, `aria-pressed`, `onClick`, `className={chipCls(active === c.key)}` and
`title`), the dot, the label and the count stay exactly as they are.

## 4. `src/app/pages/contracts/ContractsTable.tsx`: seven small edits, nothing else

The loader call, `COLUMNS`, `urgencyScore`, `handleSort`, the four `useMemo` blocks (`derived`,
`filtered`, `sorted`, `counts` / `shown`), the `useEffect`, and every line between `<DataTable`
and `</DataTable>` stay exactly as they are, including their indentation.

**4a.** Directly after the line `import ContractsChips from './ContractsChips';` add:

```tsx
import ContractRows, { ContractRowsLoading } from './ContractRows';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**4b.** Directly after the line `  const { viewAs } = useViewer();` add:

```tsx
  const isPhone = useIsPhone();
```

It is called once, here, above the `if (loading)` and `if (error)` returns (a hook may not come
after an early return).

**4c.** Directly above the line

```tsx
  if (loading) {
```

add this line, followed by one blank line:

```tsx
  if (loading && isPhone) return <ContractRowsLoading />;
```

The existing `if (loading) { … }` block under it stays exactly as it is.

**4d.** Replace

```tsx
      <div className="mx-6 mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-3">
```

with

```tsx
      <div className="mx-6 mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-3 phone:mx-4 phone:flex-col phone:items-stretch">
```

**4e.** Replace

```tsx
          className="ml-auto rounded px-2 py-1 text-red-700 border border-red-300 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-warm-ring text-xs"
```

with

```tsx
          className="ml-auto rounded px-2 py-1 text-red-700 border border-red-300 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-warm-ring text-xs phone:ml-0 phone:min-h-11 phone:text-[13px]"
```

**4f.** Replace

```tsx
      <DataTable
        columns={COLUMNS}
```

with

```tsx
      {isPhone ? (
        <ContractRows rows={shown} thisYear={thisYear} chip={chip} employee={employee} role={role} manager={manager} />
      ) : (
      <DataTable
        columns={COLUMNS}
```

**4g.** Replace

```tsx
      </DataTable>
    </div>
```

with

```tsx
      </DataTable>
      )}
    </div>
```

Do not re-indent the lines between `<DataTable` and `</DataTable>`: they must stay byte for byte
as they are today. `<ContractsChips … />` stays above both, outside the `isPhone ? … : …`.

## Acceptance — visible facts

On a phone-sized screen (375 × 667), Contracts:
1. There is no table. Under the chips is one row per employee: the name, the position under it,
   and at the right the Contract End pill with the same words and colour as the computer shows
   for that person (for example "Mon Oct 19 · in 7 days" in red, "Pending Review" in yellow with
   "ended Mon Oct 5" under it, "Renewed · was Mon Oct 5" in green). A contract ending more than
   60 days away reads "Ends" and the date, with no pill.
2. The second line of each row is the next milestone only, for example
   "6 Months · Mon Oct 19 · in 7 days"; "in 7 days" sits in a yellow box when it is 14 days away
   or less, otherwise in a light orange one. Someone past all five reads "All five milestones
   reached"; someone with no start date shows "No Start Date".
3. The rows are in the same order as the computer's table: the soonest coming event first.
4. A row whose contract ends within 30 days has a pale red background; within 60 days, or
   "Pending Review", pale yellow. Other rows are white.
5. Tap a row: the arrow turns up and the row opens in place, showing all five milestones (each
   reached one reads "Done" and the date it was reached; the next one has its date and
   "in N days"; later ones have their date), then Tenure, Start Date, State and Contract End.
   Where the board's start date differs from the roster's, a "Board Start Date" line shows it
   with one sentence of explanation. "Pending Review", "Not Renewed" and "Renewed · was …" have
   their explanation written under Contract End. Tap again: it closes. Nothing is saved.
6. A long name wraps onto a second line; it is never cut off with "…". No sideways sliding of
   the page.
7. The chips ("N Employees", "Milestone in 14 Days", "Milestone in 30 Days", "Contract Ends in
   30 Days", "Renewed") sit on one line that slides sideways; they do not wrap. Tapping a chip
   filters the rows, tapping it again clears it, and a tap just above or below a chip still
   counts.
8. With a chip that matches nobody, the list reads "No employees match" and the chip's name,
   with "Tap the highlighted chip again to clear it." under it.
9. An employee who is not on the Onboarding board shows "Not on Onboarding Board" under the
   name and no pill at the right.
10. No console errors on load, on opening a row, or on tapping a chip.

On a computer nothing changes (1440 wide, mouse):
11. Contracts shows the same ten-column table, the same chips (wrapping as before), the same
    sorting by header, the same hover titles and the same Export.
12. Dragging the window narrower than 768 px swaps the table for the rows; dragging it back
    brings the table back, with the same chip still chosen.

When done, reply with a one-line summary per file.
