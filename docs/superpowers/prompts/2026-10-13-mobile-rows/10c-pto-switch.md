# Phone view, rows 3c: PTO Tracker, part 3 of 3 (the page shows rows on a phone)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the PTO Tracker is an eleven-column table you slide sideways, and the things a
mouse-over explains (how the floating holidays were counted, why Record is switched off, the GAF
comments on a request) cannot be read at all. This prompt gives a phone one row per employee
instead: the name, the title, and **Available** as the one large number. A manager taps a row and
it opens in place to read the rest. A super user taps a row and it opens a sheet that also has
What Payroll Says, the evidence and the Record / Edit / Withdraw / Restore buttons. On a computer
nothing changes.

**This is part 3 of 3.** Parts 1 and 2 already added `src/app/lib/ptoPhone.ts`, `src/app/pages/pto/PtoRequestRows.tsx` and `src/app/pages/pto/PtoRows.tsx`, and edited `PtoBreakdown.tsx`: use them as they are and do not edit them. Make exactly the edits below.

If `src/app/pages/pto/PtoRows.tsx` does not exist, stop and say so. Do not write it.

**Only these files may change.** Two edited: `src/app/pages/pto/PtoTable.tsx`, `src/app/pages/pto/PtoComingUp.tsx`. **No other file may be touched.** No migration, no action file.

Rules:
- Only these files may change: the two listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.
- Follow the Phone section of `src/DESIGN.md`.

Also for this prompt:
- `src/app/pages/pto/RecordApprovalDialog.tsx`, `PtoVerdictCell.tsx`, `PtoPayrollCell.tsx`,
  `PtoSubRow.tsx`, `PtoRow.tsx` and `src/app/pages/PtoTracker.tsx` are **used as they are and not
  edited**, not even their spacing.
- No new data. The rows are built from what the table already loads. Do not add a
  `useLoadAction` or a `useMutateAction` call anywhere, and do not import anything from
  `@/actions/` in the three new files.
- Record, Edit, Withdraw and Restore stay super-user only. Do not move, copy or loosen any
  `isSuper` check.

Already in the app from earlier prompts. **Use them; do not create, edit or redefine them:**
- `src/app/lib/useIsPhone.ts` exports the hook `useIsPhone(): boolean` (a named export).
- `src/tailwind.config.js` has a screen named `phone`, so a class written `phone:px-4` applies
  only on a phone-sized screen. Do not replace any `phone:` class below with `sm:`, `md:` or
  `max-md:`.
- `src/app/components/mobile/MobileRow.tsx` (default export) is one row of a phone list.
- `src/app/components/mobile/MobileSheet.tsx` (default export) is the slide-up sheet.

If `src/app/components/mobile/MobileRow.tsx` or `src/app/lib/useIsPhone.ts` does not exist, stop
and say so. Do not write them.


## 5. `src/app/pages/pto/PtoTable.tsx`: six edits, nothing else

The page asks "is this a phone?" once, here, and draws either the rows or the table, never both.
Both get the same list (`sorted`). The table (`<DataTable …>` down to `</DataTable>`) is not
edited at all.

**5a.** Directly after the line `import PtoBreakdown from './PtoBreakdown';` add:

```tsx
import PtoRows from './PtoRows';
```

**5b.** Replace

```tsx
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
```

with

```tsx
import { sortRows, nextSortDir } from '@/app/lib/ptoSort';
import { nothingFoundText } from '@/app/lib/ptoPhone';
import { useIsPhone } from '@/app/lib/useIsPhone';
```

**5c.** Directly after the line `  const { viewAs, isSuper } = useViewer();` add:

```tsx
  const isPhone = useIsPhone();
```

**5d.** Replace

```tsx
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;
```

with

```tsx
    `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors phone:min-h-11 phone:px-3.5 ${on ? 'border-warm bg-warm-tint text-warm-text' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`;
```

**5e.** Replace

```tsx
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3">
```

with

```tsx
      <div className="flex flex-wrap items-center gap-2 px-6 pb-3 phone:flex-nowrap phone:overflow-x-auto phone:whitespace-nowrap phone:px-4">
```

**5f.** Replace

```tsx
      {/* Table */}
      {loading && (rawRows as RawRow[]).length === 0 ? (
```

with

```tsx
      {/* Rows on a phone, the table everywhere else: one of the two, never both */}
      {isPhone && !error ? (
        <PtoRows
          rows={sorted}
          loading={loading && (rawRows as RawRow[]).length === 0}
          emptyText={nothingFoundText({ employee, role, manager, chip: isSuper ? chip : null })}
          expanded={expanded}
          onToggle={handleToggle}
          year={year}
          today={today}
          periods={periods as PeriodRow[]}
          onOpenDialog={onOpenDialog}
          onChanged={handleChanged}
          refreshToken={detailKey}
        />
      ) : loading && (rawRows as RawRow[]).length === 0 ? (
```

Everything else in this file stays exactly as it is: both `useLoadAction` calls, `COLUMNS`, the
sorting and filtering, the two chips, and every line from `<DataTable` to `</DataTable>`.
`useIsPhone()` is called in this file only: not in `PtoRows`, `PtoRequestRows` or `PtoBreakdown`.


## 6. `src/app/pages/pto/PtoComingUp.tsx`: one edit, nothing else

While Coming Up loads it shows four grey boxes in a line, 920 px wide, which run out of the card
on a phone. Replace

```tsx
        <div className="flex gap-2" aria-hidden="true">
```

with

```tsx
        <div className="flex gap-2 phone:overflow-hidden" aria-hidden="true">
```


## Acceptance — visible facts

On a phone-sized screen (375 × 667), PTO Tracker, **as a manager** (or a super user using View As
on a manager):
1. Under Coming Up there is one row per employee, in name order, the same employees as on the
   computer. Each row shows the name (a long name wraps, it is never cut with "…"), the title
   under it, and on the right a large number with the word "Available" under it. A negative
   number is red. The second line reads like "12.36 accrued · 3.00 taken". No Review pill.
2. An employee with no start date shows "no start date" in amber under the title and "—" as the
   number.
3. Each row has a down arrow. Tapping it opens that employee in place (the arrow turns up):
   Start Date, FH Left with its explanation written under the number ("Used 1 of 2 this year ·
   August sheet said 1", or "Eligible Mon Dec 14 — 90 days after hire"), Paid PTO, WFH, Birthday,
   then "Requests": one row per request with 🌴 or ⭐, the type and "3 days", a Pending / Recorded /
   Withdrawn pill, the dates and "back Mon Aug 24". Tapping the row again closes it.
4. **A manager sees no Record, Edit, Withdraw or Restore button anywhere, and no "What Payroll
   Says" or "Evidence".**
5. The page scrolls as one page; nothing slides sideways except Coming Up.

On a phone-sized screen, **as a super user**:
6. Rows also show a yellow "N to review" pill and "N not yet" where the computer's Review column
   shows them. The strip above the list ("45 Employees", To Review, Not Yet) is on one line; the
   two chips are 44 px tall and still filter the list. With To Review on and nobody matching, the
   list says "No employees match To Review".
7. Each row has a right arrow. Tapping it opens a full-height sheet titled with the employee's
   name: Available, Accrued, Taken, the same balances as in fact 3, then the requests. Each
   request also shows What Payroll Says, Evidence, and its buttons, each 44 px tall.
8. A pending request whose return date has not passed shows Record greyed out with the reason
   written under it: "Record after the return date has passed".
9. Tap Record on a request that can be recorded: the Record PTO pop-up opens **on top of** the
   sheet. **Cancel it; save nothing.** The sheet is still open behind. The same for Edit on a
   recorded request: open, then cancel.
10. Tap Withdraw on a recorded request: the browser asks "Withdraw this record? Days will drop
    by N." **Choose Cancel.** Nothing changes.
11. The × at the top right closes the sheet. No console errors on load or after any tap.

While loading (both kinds of user):
12. Before the employees arrive, five grey placeholder rows show where the list will be. The four
    grey boxes in Coming Up stay inside its white card.

On a computer nothing changes (1440 wide, mouse):
13. The PTO Tracker shows the same table with the same columns, sorting by a click on a column
    heading, the same chips at the same size, and a row still opens the same small table of
    requests with the same buttons.

When done, reply with a one-line summary per file.

