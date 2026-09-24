# 04 (F3) — The scope rule: which employees the signed-in filer may choose

> **⚠ This prompt goes into the 'GAF Disciplinary Actions Form' app (PC3PsXDDa9), NOT the GAF Panama HR Hub. Check the project name in the builder before pasting.**

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these two files may be created or changed. No other file may be touched.**

- `src/app/utils/filerScope.ts` — NEW, content below, character for character.
- `src/app/hooks/useMondayAutofill.ts` — three small additions, below.

Do not use `filerScope` in any page yet (the next prompt does). Do not touch
`Step1EmployeeWarning.tsx`, `OfferLetterForm.tsx`, `disciplinaryFormData.ts`, any action,
or anything under `components/ui/`.

## Why

Today anyone can type any manager name and file for any employee. The rule becomes:
- an **admin** (`disciplinary_admins`) may file for every current employee;
- anyone else may file only for the current employees who list **their login email** in
  any of the four Monday manager slots.

The rule is a pure function in its own file so the HR Hub's git repo can unit-test it
directly with node. That is why it has **no imports and no React**, and uses only plain
TypeScript (interfaces, types, functions — no `enum`, no `namespace`).

## 1. `src/app/utils/filerScope.ts` — NEW

```ts
// Which employees the signed-in filer may file a disciplinary action for.
// PURE: no React, no imports. The HR Hub's git repo unit-tests this file by path
// with node, so keep it plain TypeScript (no enum, no namespace, no path aliases).

export interface FilerManager {
  name: string;               // manager display name from the Monday slot ('' allowed)
  email: string;              // manager email from the slot ('' when the slot has none)
  reports: readonly string[]; // current employees who list this manager in any slot
}

export interface FilerScopeInput {
  email: string;                     // signed-in user's email (loadCurrentFiler.email)
  isAdmin: boolean;                  // loadCurrentFiler.is_admin
  adminName: string | null;          // loadCurrentFiler.admin_name
  managers: readonly FilerManager[]; // one entry per manager email (useMondayAutofill().managerEntries)
  allEmployees: readonly string[];   // every current employee (Current Employees group)
}

export interface FilerScope {
  employees: string[]; // sorted, de-duplicated names the filer may choose
  filerName: string;   // shown on the banner and saved as manager_name
  matched: boolean;    // true when the email matched at least one Monday manager slot
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function sortedUnique(names: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const n of names) {
    const t = (n ?? '').trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort();
}

export function employeesForFiler(input: FilerScopeInput): FilerScope {
  const email = norm(input.email);
  // A blank login never matches a slot that has no email.
  const mine = email ? input.managers.filter(m => norm(m.email) === email) : [];
  const matched = mine.length > 0;
  const mondayName = mine
    .map(m => (m.name ?? '').trim())
    .find(n => n !== '' && norm(n) !== email) ?? '';
  const filerName = mondayName || (input.adminName ?? '').trim() || email;
  const employees = !email
    ? []
    : input.isAdmin
      ? sortedUnique(input.allEmployees)
      : sortedUnique(mine.flatMap(m => m.reports));
  return { employees, filerName, matched };
}
```

Behaviour, so nothing gets "improved" away:
- Email compare is trimmed and case-insensitive on both sides.
- A person can sit in several slots (Manager 1 for some people, Manager 3 for others):
  they get the **union** of all those reports.
- Admin → every current employee, even if they are also a manager somewhere.
- Unknown email, or blank email → `employees: []`.

## 2. `src/app/hooks/useMondayAutofill.ts` — three additions

Everything that exists today stays exactly as it is (`managerMap`, `managers`,
`employeePositionMap`, `employeeBranchMap`, `allEmployees`, `loading`, the
`CURRENT_GROUP_ID = 'topics'` filter and the four `MANAGER_SLOTS`).

**2a.** Replace

```ts
  const [employeesResult, employeesLoading] = useLoadAction(getMondayEmployeesAction, [], {});
```

with

```ts
  const [employeesResult, employeesLoading, employeesLoadError] = useLoadAction(getMondayEmployeesAction, [], {});
```

**2b.** Directly **after** the `for (const item of currentItems) { … }` loop that fills
`byKey` (and before the `// The form looks managers up by display name` comment), add

```ts
  // One entry per manager email, BEFORE the merge-by-name below, so two managers who
  // share a display name never lose an email. Used by filerScope.employeesForFiler.
  const managerEntries: ManagerInfo[] = [...byKey.values()].filter(m => m.email);
```

**2c.** Just above the `return`, add

```ts
  // Monday failed: the request errored, or it came back with no Current Employees.
  const employeesError = !employeesLoading &&
    (Boolean(employeesLoadError) || currentItems.length === 0);
```

and change the `return` line to

```ts
  return { managerMap, managerEntries, employeePositionMap, employeeBranchMap, allEmployees, managers, loading, employeesError };
```

## Acceptance

1. `filerScope.ts` exists with exactly the content above and has **no `import` line**.
2. `useMondayAutofill.ts`: the only differences are 2a, 2b and 2c. The form still behaves
   exactly as before (nothing uses the new values yet).
3. Both files under 15 KB; lint clean.

## Report back

List every file you created, changed or deleted, and the byte size of both files.
