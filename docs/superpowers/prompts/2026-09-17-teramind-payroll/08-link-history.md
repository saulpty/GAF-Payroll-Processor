# 08 — Link former employees and old (deleted) Teramind accounts, so past periods compare fully

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…`. Never create a top-level folder named `src`.**

## Files that may change

- `src/app/pages/admin/teramind/useTeramindPull.ts`
- `src/app/pages/admin/teramind/TeramindAgentsCard.tsx`
- `src/app/pages/admin/teramind/TeramindPullCard.tsx`

No other file may be touched. Do not modify anything under `src/app/lib/` or `src/actions/`. Never
edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`, `classificationEngine.ts`,
`AdminLookups.tsx`, `teramindParser.ts`, or anything under `src/components/ui/`.

## What the comparison showed (on /dev, all 12 periods, Time Records)

Where both sides have times, **96.7% of 3,923 days match payroll to the minute**. But 873 days have
payroll times and no Teramind record — concentrated in the older periods and in two kinds of people:

1. **Former employees** (inactive in our `employees` table). `syncAgents` only links the active
   list, so their Teramind accounts were never linked and their records were dropped.
2. **Current employees whose old Teramind account was deleted** (a replaced laptop, a machine-name
   account such as `name@someones-macbook`). `syncAgents` throws deleted accounts away before
   linking, so their older records were dropped too.

## 1. `useTeramindPull.ts` — `syncAgents`

- Employees come from the existing **`loadAllEmployees`** action (no params; returns active **and**
  inactive, with `id` and `teramind_email`) instead of `loadAttendanceEmployees`. Skip rows with an
  empty `teramind_email`.
- Run `linkAgents(allAgents, employees)` over **every** directory agent, deleted ones included,
  *before* deciding what to keep.
- Keep (save) an agent when it is **not deleted, or already linked, or linked by this run**. Deleted
  agents that match nobody are still left out.
- Then `updateTeramindAgentLinks` with `linked_by: 'auto'` exactly as today.
- Return `{ agents, linked, unlinked }` as today, where `unlinked` counts only **active** employees
  with no agent (`active === true` from `loadAllEmployees`).

`pullRange` is unchanged, except for one new optional 4th argument described below.

## 2. `TeramindAgentsCard.tsx`

- Tiles: **Linked Employees** (distinct employees with at least one agent — active and former),
  **Active Employees With No Agent**. The pick-an-agent list shows only **active** employees with no
  agent, and its dropdown now also offers deleted agents, labelled `name (email) · deleted`.
- One muted line: "Includes N former employee(s) and M deleted Teramind account(s), linked so past
  periods can be compared."

## 3. `TeramindPullCard.tsx`

- A checkbox next to the Backfill button: **Re-Pull Periods Already Covered** (default off). When
  on, the backfill ignores `coversRange` and pulls every period again. Saving is idempotent, so this
  is safe; it exists because newly linked accounts need their history fetched.

## Rules

Every file under 15 KB · action params always **flat** · dates are `YYYY-MM-DD` strings compared as
strings · all time conversion through `sessionClock` only · no hardcoded ids or URLs · Title Case
labels · this tab never writes to `payroll_entries`.

## Acceptance (check on /dev)

1. "Sync Teramind Roster" links more agents than before (former employees and deleted accounts);
   Active Employees With No Agent stays 0.
2. Backfill with **Re-Pull Periods Already Covered** ticked pulls all 12 periods, 0 failed.
3. Comparison → All Periods → Time Records: **Payroll Only** falls far below 873.
4. Only the three files above changed.
