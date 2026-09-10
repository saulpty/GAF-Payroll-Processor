# 11 — Contracts page reads the renewal status instead of guessing

After prompt 10 and a Contracts sync, `monday_contracts.renewal_status` holds
the board's status label. The page must stop treating "end date in the past" as
*Renewed*.

## Files you may change

- `src/actions/loadContractMilestones.ts`
- `src/app/lib/tenure.ts` — add one pure function
- `src/app/pages/contracts/ContractRow.tsx`
- `src/app/pages/contracts/ContractsTable.tsx`
- `src/app/pages/Contracts.tsx` — the export's Status column only

**No other file may be touched.** `loadContractsExpiringCount` is unchanged (the
badge keeps counting contracts ending within 30 days). No `new Date(str)`.

## loadContractMilestones.ts

Add `c.renewal_status` to the SELECT. Nothing else.

## tenure.ts

```ts
export type RenewalState = 'renewed' | 'not_renewed' | 'pending';
/** Board status → renewal: Passed = renewed, Failed = not renewed, anything else pending. */
export function renewalState(status: string | null | undefined): RenewalState {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'passed') return 'renewed';
  if (s === 'failed') return 'not_renewed';
  return 'pending';
}
```
A local test pins it (T7): `'Passed'`, `' passed '`, `'PASSED'` → renewed;
`'Failed'` → not_renewed; `''`, `null`, `'Pending review'` → pending.

## ContractsTable.tsx

`RawRow` gains `renewal_status: string | null`; the derived row gains
`renewal: renewalState(r.renewal_status)` (import from `tenure`). Contract end
header tip becomes: "From the board's 6 Contract End Date. Renewed / Not renewed
comes from the board's renewal status; Pending review means no decision recorded yet."

## ContractRow.tsx

`ContractRowData` gains `renewal: RenewalState`. The **Contract end** cell:

- `kind === 'none'`: unchanged (—).
- `kind === 'ended'`:
  - renewed → `<StatusChip tone="green">Renewed</StatusChip>` with the muted
    `was MM-DD-YYYY` line under it, title "Board status Passed. Fixed term ended on <date>."
  - not_renewed → `<StatusChip tone="red">Not renewed</StatusChip>` + `ended <date>`, title "Board status Failed — still on the active roster."
  - pending → `<StatusChip tone="amber">Pending review</StatusChip>` + `ended <date>`, title "Fixed term ended and the board has no renewal decision yet."
- `kind === 'future'`: keep today's countdown chip (red ≤ 30 d, amber ≤ 60 d,
  plain date otherwise) and, when `renewal !== 'pending'`, append a second line
  `renewed` (emerald-700) or `not renewed` (red-700) in 10px under it.

Wrap chips in a `<span title=…>` since `StatusChip` has no title prop. File stays under 15 KB.

## Contracts.tsx

Export Status: `ended` → `Renewed` / `Not renewed` / `Pending review` by
`r.renewal`; `future` → `Ending in N days` plus ` · renewed` / ` · not renewed`
when decided. Header unchanged.

## Verify

- `/contracts`: rows whose board status is Passed show a green *Renewed*; Failed
  shows red *Not renewed*; ended with no decision shows amber *Pending review*.
  Report the counts of each on screen.
- Export Status column matches the screen. Default sort unchanged.
- Only the five files changed. Confirm every identifier used is imported.
