# Title Case on labels + signed-in user's name in the top bar

This is a text-only change plus one small chip. **Only these files may change:**

1. `src/app/pages/Disciplinary.tsx`
2. `src/app/pages/disciplinary/DisciplinaryTable.tsx`
3. `src/app/pages/disciplinary/DisciplinaryRow.tsx`
4. `src/app/pages/disciplinary/ActionDetail.tsx`
5. `src/app/pages/disciplinary/CloseCaseDialog.tsx`
6. `src/app/pages/attendance/AttendanceKpis.tsx`
7. `src/app/pages/attendance/AttendancePanel.tsx`
8. `src/app/pages/contracts/ContractsTable.tsx`
9. `src/app/pages/contracts/ContractRow.tsx`
10. `src/app/pages/pto/PtoTable.tsx`
11. `src/app/pages/pto/PtoBreakdown.tsx`
12. `src/app/pages/PtoTracker.tsx`
13. `src/app/components/AccessGate.tsx`
14. `src/app/TopNav.tsx`

**No other file may be created, modified or deleted.** Do not touch any payroll
page, `src/components/ui/`, `src/app/lib/`, or any action. Do not change any
logic, class name, tooltip text, `title=` hover text, or `aria-label`, except
where the table below says so.

## Part A — Title Case

Replace each visible string exactly as listed. Keep the surrounding JSX as is.

| File | Before | After |
|---|---|---|
| `Disciplinary.tsx` | PageHeader `title="Disciplinary actions"` | `title="Disciplinary Actions"` |
| `Disciplinary.tsx` | link text `New action form` | `New Disciplinary Action` |
| `Disciplinary.tsx` | link `title="Open Disciplinary Action Form"` | `title="New Disciplinary Action"` |
| `DisciplinaryTable.tsx` | column label `'Filed by'` | `'Filed By'` |
| `DisciplinaryTable.tsx` | column label `'Highest level'` | `'Highest Level'` |
| `DisciplinaryTable.tsx` | EmptyState `title="No employees match"` | `title="No Employees Match"` |
| `DisciplinaryRow.tsx` | `` `review overdue ${days} d` `` | `` `Review Overdue ${days} d` `` |
| `DisciplinaryRow.tsx` | `` `re-eval ${fmtDate(nextReval)}` `` | `` `Re-Eval ${fmtDate(nextReval)}` `` |
| `DisciplinaryRow.tsx` | `'no re-evaluation set'` | `'No Re-Evaluation Set'` |
| `DisciplinaryRow.tsx` | `'all closed'` | `'All Closed'` |
| `DisciplinaryRow.tsx` | chip `not on roster` | `Not on Roster` |
| `DisciplinaryRow.tsx` | chip `inactive` | `Inactive` |
| `ActionDetail.tsx` | `This case is open.` | `This Case Is Open` |
| `ActionDetail.tsx` | button text `Close case` | `Close Case` |
| `CloseCaseDialog.tsx` | `<DialogTitle>Close case</DialogTitle>` | `Close Case` |
| `CloseCaseDialog.tsx` | label `Closed by` | `Closed By` |
| `CloseCaseDialog.tsx` | submit button text `'Close case'` | `'Close Case'` |
| `AttendanceKpis.tsx` | `` `${kpis.onTime} of ${kpis.daysTracked} expected` `` | `` `${kpis.onTime} of ${kpis.daysTracked} Expected` `` |
| `AttendanceKpis.tsx` | `` `${kpis.lateDays} of ${kpis.daysTracked} expected` `` | `` `${kpis.lateDays} of ${kpis.daysTracked} Expected` `` |
| `AttendanceKpis.tsx` | `sub="scheduled shifts"` | `sub="Scheduled Shifts"` |
| `AttendanceKpis.tsx` | `` `${kpis.lateReported} reported · ${kpis.lateUnreported} not` `` | `` `${kpis.lateReported} Reported · ${kpis.lateUnreported} Not` `` |
| `AttendanceKpis.tsx` | `sub="per late day"` | `sub="Per Late Day"` |
| `AttendanceKpis.tsx` | `sub="reported or not"` | `sub="Reported or Not"` |
| `AttendanceKpis.tsx` | `sub="late/absent, form filed"` | `sub="Late/Absent, Form Filed"` |
| `AttendanceKpis.tsx` | `sub="late/absent, no form"` | `sub="Late/Absent, No Form"` |
| `AttendanceKpis.tsx` | `sub="PTO, holidays"` | `sub="PTO, Holidays"` |
| `AttendancePanel.tsx` | legend label `'Time off'` | `'Time Off'` |
| `ContractsTable.tsx` | column label `'Contract end'` | `'Contract End'` (leave its `tip` text alone) |
| `ContractsTable.tsx` | EmptyState `title="No employees match"` | `title="No Employees Match"` |
| `ContractRow.tsx` | chip `Not renewed` | `Not Renewed` |
| `ContractRow.tsx` | chip `Pending review` | `Pending Review` |
| `ContractRow.tsx` | chip `No start date` | `No Start Date` |
| `PtoTable.tsx` | checkbox label `Only with review` | `Only With Review` |
| `PtoTable.tsx` | EmptyState `title="No employees match"` | `title="No Employees Match"` |
| `PtoBreakdown.tsx` | EmptyState `title="Nothing recorded or pending"` | `title="Nothing Recorded or Pending"` |
| `PtoTracker.tsx` | button text `Add manually` | `Add Manually` |
| `AccessGate.tsx` | `<h2 …>No access</h2>` | `No Access` |
| `AccessGate.tsx` | button text `Stop viewing as` | `Stop Viewing As` |

Sentences (paragraphs, hints, tooltips, error messages) stay as they are.

## Part B — Show who is signed in, in the top bar

In `src/app/TopNav.tsx`, `useViewer()` already gives `isSuper`, `isViewingAs`,
`name`, `email`. Today, a chip appears at the right end of the header **only**
while a super user is "viewing as" someone.

Add a chip for the normal case, so every person sees whose view they are in:

- When `isViewingAs` is **false**, render, in the same position (`ml-auto shrink-0`),
  a non-clickable `<div>`:
  - classes: `ml-auto shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-slate-100 text-slate-700 border border-slate-200`
  - content: a `UserCircle` icon from `lucide-react` (`w-3.5 h-3.5`), then
    `{name || email}`, then a muted role: `<span className="text-slate-400">· {isSuper ? 'Super User' : 'Manager'}</span>`
  - `title={email}`
- When `isViewingAs` is **true**, keep the existing amber "Viewing as …" button
  exactly as it is, except change its text `Viewing as` → `Viewing As`.
- Add `UserCircle` to the existing `lucide-react` import. Nothing else changes.

`TopNav.tsx` must stay under 15 KB.

## Acceptance

- `git diff` shows only string changes in files 1–13, and in `TopNav.tsx` the new
  chip plus the `UserCircle` import and the `Viewing As` text.
- Confirm every identifier used in each file is imported.
- The app loads; the top bar shows "Saul Fallembaum · Super User" at the right.
