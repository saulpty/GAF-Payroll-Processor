# Phone view, rows 4c: Contracts, part 3 of 3 (the page shows rows on a phone)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

On a phone today the Contracts page is a ten-column table you slide sideways, and four things can
only be read by hovering with a mouse: the date a milestone was reached, the board's start date
when it differs from the roster's, and the sentence that explains "Pending Review" or "Not
Renewed". This prompt gives the phone one row per employee instead (name, position, the Contract
End pill, the next milestone), which opens in place to show everything the table holds, written
out. The summary chips become one line that slides sideways. The computer keeps the table exactly
as it is.

**This is part 3 of 3.** Parts 1 and 2 already added the phone words to `src/app/lib/contractChips.ts`, edited `src/app/pages/contracts/ContractsChips.tsx` and added `src/app/pages/contracts/ContractRows.tsx`: use them as they are and do not edit them. Make exactly the edits below.

If `src/app/pages/contracts/ContractRows.tsx` does not exist, stop and say so. Do not write it.

**Only this file may change.** One edited: `src/app/pages/contracts/ContractsTable.tsx`. **No other file may be touched.** No migration, no action file.

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
