# Phone view, rows 4b: Contracts, part 2 of 3 (the phone rows)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Contracts page is a ten-column table you slide sideways, and four things can
only be read by hovering with a mouse: the date a milestone was reached, the board's start date
when it differs from the roster's, and the sentence that explains "Pending Review" or "Not
Renewed". This prompt gives the phone one row per employee instead (name, position, the Contract
End pill, the next milestone), which opens in place to show everything the table holds, written
out. The summary chips become one line that slides sideways. The computer keeps the table exactly
as it is.

**This is part 2 of 3.** Part 1 already added the phone words at the end of `src/app/lib/contractChips.ts` (`milestoneLines`, `nextMilestoneLine`, `contractEndView`, `noMatchLine` and their types) and made `CHIPS` an export of `src/app/pages/contracts/ContractsChips.tsx`: use them as they are and do not edit either file. This part only adds one new file that nothing renders yet, so nothing on any screen changes after this part. Part 3 follows. Write the file exactly as given: do not adapt it, shorten it, or wire it into anything.

If `src/app/lib/contractChips.ts` has no `contractEndView`, or `src/app/pages/contracts/ContractsChips.tsx` has no `export const CHIPS`, stop and say so. Do not write them.

**Only this file may change.** One new: `src/app/pages/contracts/ContractRows.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only this file may change: the one listed above. No other file may be touched. No action file, no migration.
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


## Acceptance

1. The new file exists with exactly the content above.
2. No existing file changed, and every page looks and works as before on a phone and on a computer.

When done, reply with a one-line summary per file.
