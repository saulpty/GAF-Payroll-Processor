# Phone view, rows 4a: Contracts, part 1 of 3 (the words and the chips)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Contracts page is a ten-column table you slide sideways, and four things can
only be read by hovering with a mouse: the date a milestone was reached, the board's start date
when it differs from the roster's, and the sentence that explains "Pending Review" or "Not
Renewed". This prompt gives the phone one row per employee instead (name, position, the Contract
End pill, the next milestone), which opens in place to show everything the table holds, written
out. The summary chips become one line that slides sideways. The computer keeps the table exactly
as it is.

**This is part 1 of 3.** It adds, at the end of `contractChips.ts`, the words the phone rows will show (nothing uses them yet), and makes the four edits to `ContractsChips.tsx`. The table stays on every screen after this part. Parts 2 and 3 follow as separate prompts. Make the edits exactly as given: do not adapt them, shorten them, or wire anything else in. Functions that nothing uses yet are expected: leave them.

**Only these files may change.** Two edited: `src/app/lib/contractChips.ts`, `src/app/pages/contracts/ContractsChips.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the two listed above. No other file may be touched. No action file, no migration.
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


## Acceptance

1. `contractChips.ts` has exactly the one addition at its end, and `ContractsChips.tsx` has exactly the four edits.
2. On a computer (1440 wide, mouse), Contracts looks and works exactly as before: the same table, the same chips (wrapping as before), the same counts, and a chip still filters the table.
3. On a phone-sized screen (375 × 667) the only change is the chips: they sit on one line that slides sideways instead of wrapping, and a tap just above or below a chip still counts. The table under them is still the table.
4. No console errors.

When done, reply with a one-line summary per file.
