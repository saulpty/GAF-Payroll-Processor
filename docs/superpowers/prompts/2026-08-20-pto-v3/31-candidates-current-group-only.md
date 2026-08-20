Fix a live bug in the Directory sync's "Add unmatched Monday employees?" dialog.

Only `src/app/pages/admin/employees/syncDirectory.ts` may change. No other file.

## The rule, from the owner, again

> "I don't consider an employee active until he is on that Panama Employee Directory board, in the Current Employees group."

The sync already honours this for `employees.active` and for collapsing duplicate rows. It does **not** honour it when building the list of people to offer creating.

## The bug

Today's sync offered to create Juan Moreno, Anagabriela Perez and Yulisse Palacio. All three are in the **Past employees** group. They must never be offered — they are former staff, and creating them would put ex-employees into the active roster.

In `syncDirectory.ts` the candidate block already computes `isCurrent` and uses it only to *prefer* a current-group row:

```ts
if (email && !emailSet.has(email)) {
  const isCurrent = item.group?.id === dk.monday_group_directory_current;
  const existing = candidateMap.get(email);
  // Prefer current-group row; otherwise keep first seen
  if (!existing || isCurrent) {
    candidateMap.set(email, { name: item.name, email, role, manager, isCurrent });
  }
}
```

## The fix

Only rows in the current group may become candidates at all. Change the guard to:

```ts
const isCurrent = item.group?.id === dk.monday_group_directory_current;
// Only Current Employees may be offered for creation. A person in Past
// employees is a former employee: offering to create them would add an
// ex-employee to the active roster.
if (email && !emailSet.has(email) && isCurrent) {
  const existing = candidateMap.get(email);
  if (!existing) {
    candidateMap.set(email, { name: item.name, email, role, manager, isCurrent });
  }
}
```

Keep `unmatchedCount++` exactly where it is and counting every unresolved row regardless of group — the "N unmatched" figure in the summary stays a full count of rows the resolver could not match, which is the diagnostic it is meant to be.

## Acceptance
- Running the Directory sync no longer offers Juan Moreno, Anagabriela Perez or Yulisse Palacio.
- The dialog only ever appears for people in the Current Employees group who are not already in `employees`.
- The unmatched count in the result summary is unchanged.
- No Monday board, column or group id is hardcoded — `dk.monday_group_directory_current` still comes from config.

## Do not change
- The email → alias → name resolution order.
- The duplicate-row collapse.
- The onboarding start-date pass.
- `active` derivation from group membership.
