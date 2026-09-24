# 05 (F4) — Step 1: no manager boxes; the filer is the login; the picker lists only their people

> **⚠ This prompt goes into the 'GAF Disciplinary Actions Form' app (PC3PsXDDa9), NOT the GAF Panama HR Hub. Check the project name in the builder before pasting.**

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these six files may be created or changed. No other file may be touched.**

- `src/app/hooks/useFilerScope.ts` — NEW
- `src/app/pages/wizard/FilerBanner.tsx` — NEW
- `src/app/pages/wizard/EmployeePicker.tsx` — NEW
- `src/app/pages/wizard/Step1EmployeeWarning.tsx`
- `src/app/utils/disciplinaryFormData.ts`
- `src/app/pages/OfferLetterForm.tsx` — **only** the follow-up and default-date lines in §6

Do not touch `filerScope.ts`, `useMondayAutofill.ts`, any action, `generatePdf.ts`,
`PriorActionsPanel.tsx`, the other wizard steps, or anything under `components/ui/`.
Do not change the validation or `handleSubmit` in `OfferLetterForm.tsx` (next prompt).

## Why

Today Step 1 has a free-text **Manager Name** and **Manager Email**. Anyone can type any
manager and file for any employee, and if Monday is slow the picker falls back to a
hardcoded list of 40 names. After this prompt:

- there are no manager boxes; a banner says who is filing — the signed-in user;
- the employee picker lists only `employeesForFiler(...)` — admins: everyone current;
  managers: their own reports;
- the hardcoded list is gone; if Monday fails, the form says so;
- "Follow up" on a prior action no longer replaces the filer with the old manager;
- the default date is today in **Panama** time (today it is UTC, so after 7 pm it shows
  tomorrow).

## 1. `src/app/hooks/useFilerScope.ts` — NEW

```ts
import { useLoadAction } from '@uibakery/data';
import loadCurrentFilerAction from '@/actions/loadCurrentFiler';
import { useMondayAutofill } from '@/app/hooks/useMondayAutofill';
import { employeesForFiler } from '@/app/utils/filerScope';

export type FilerStatus = 'loading' | 'filerError' | 'notSignedIn' | 'mondayError' | 'empty' | 'ready';

interface FilerRow { email: string | null; is_admin: boolean | null; admin_name: string | null; }

// Who is filing (the signed-in user) and which employees they may file for.
export function useFilerScope() {
  const monday = useMondayAutofill();
  const [rows, filerLoading, filerError] = useLoadAction(loadCurrentFilerAction, [] as FilerRow[], {});
  const row = (rows as FilerRow[])[0] ?? null;
  const email = (row?.email ?? '').trim().toLowerCase();
  const isAdmin = row?.is_admin === true;

  const scope = employeesForFiler({
    email,
    isAdmin,
    adminName: row?.admin_name ?? null,
    managers: monday.managerEntries,
    allEmployees: monday.allEmployees,
  });

  let status: FilerStatus;
  if (filerLoading || monday.loading) status = 'loading';
  else if (filerError) status = 'filerError';
  else if (!email) status = 'notSignedIn';
  else if (monday.employeesError) status = 'mondayError';
  else if (scope.employees.length === 0) status = 'empty';
  else status = 'ready';

  return {
    status,
    email,
    isAdmin,
    filerName: scope.filerName,
    employees: scope.employees,
    employeePositionMap: monday.employeePositionMap,
    employeeBranchMap: monday.employeeBranchMap,
  };
}
```

`useLoadAction(..., {})` — params flat. Never `{ params: {} }`.

## 2. `src/app/pages/wizard/FilerBanner.tsx` — NEW

A small presentational component. Props: `name: string`, `email: string`, `isAdmin: boolean`,
`count: number`. It renders one line in the same green box style the old
"Manager matched from Monday.com" badge used (`#F0FDF4` background, `#BBF7D0` border,
`UserCheck` icon, `text-xs`):

> Filing as **{name}** ({email}) · {isAdmin ? 'all employees' : `${count} employee(s)`}

(`1 employee`, `6 employees` — singular for 1.)

## 3. `src/app/pages/wizard/EmployeePicker.tsx` — NEW

Props: `value: string`, `employees: string[]`, `status: FilerStatus` (import the type from
`useFilerScope`), `error?: string`, `onSelect: (name: string) => void`.

It renders the **Employee \*** label, a message when `status !== 'ready'`, and the same
`<select id="employeeName">` markup Step 1 has today (same classes, `— Select employee —`
first option, red border when `error`, the error text under it). The select is
**disabled unless `status === 'ready'`**, and lists exactly `employees` — nothing prepended,
no other source.

Messages, exact text:

| status | message |
|---|---|
| `loading` | Loading your employees from Monday… |
| `filerError` | Couldn't check who is signed in — reload the page. |
| `notSignedIn` | You're not signed in. Sign in with your work email and reload the page. |
| `mondayError` | Couldn't load employees from Monday — reload the page. |
| `empty` | No employees are assigned to you in the Monday directory. Ask Saul or Tim. |

Use the existing amber hint style (`bg-amber-50 border-amber-200 text-amber-700`, `Info`
icon) for all but `loading`, which is plain `text-muted-foreground`.

## 4. `src/app/pages/wizard/Step1EmployeeWarning.tsx`

**Remove:**
- `EMPLOYEES` from the `disciplinaryFormData` import, and the line
  `const FALLBACK_EMPLOYEES = EMPLOYEES.map(e => e.name).sort();`
- `import { useMondayAutofill } …` and the line
  `const { managerMap, employeePositionMap, employeeBranchMap, allEmployees, managers, loading: mondayLoading } = useMondayAutofill();`
- the manager state (`managerInput`, `showSuggestions`, `highlightIdx`, `suggestRef`,
  `inputRef`) and the `useEffect` that does `setManagerInput(data.managerName)`;
- everything from `const filteredManagers = …` down to and including the `mousedown`
  `useEffect` (that is `matchedManager`, `baseEmployeeList`, `employeeList`,
  `managerEntered`, `handleManagerInput`, `selectManager`, `handleManagerKeyDown`);
- in the JSX: the whole `{/* ── Manager Section ── */}` block (Manager Name input,
  suggestions dropdown, Manager Email input) and the `{/* Manager match badge */}` block;
- in the Employee section: the `<Label htmlFor="employeeName">…`, the
  "Please enter the manager's name first…" hint and the `<select id="employeeName">…</select>`
  with its error line — replaced by `<EmployeePicker>` below;
- any import that becomes unused (e.g. `UserCheck`).

**Add** (imports: `useFilerScope`, `FilerBanner`, `EmployeePicker`):

```tsx
  const filer = useFilerScope();

  // The filer is the signed-in user. Fill the form's manager fields from the login —
  // never from typing. The PDF "Supervisor" line and the email use them.
  useEffect(() => {
    if (filer.status === 'loading' || !filer.email) return;
    if (data.managerName !== filer.filerName || data.managerEmail !== filer.email) {
      onChange({ managerName: filer.filerName, managerEmail: filer.email });
    }
  }, [filer.status, filer.filerName, filer.email, data.managerName, data.managerEmail]);

  // A chosen employee who is not in this filer's list is cleared.
  const allowedKey = filer.employees.join('|');
  useEffect(() => {
    if (filer.status === 'ready' && data.employeeName && !filer.employees.includes(data.employeeName)) {
      onChange({ employeeName: '', employeeRole: '', employeeBranch: '' });
    }
  }, [filer.status, allowedKey, data.employeeName]);
```

Replace `handleEmployeeChange` with (no fallback list):

```tsx
  const handleEmployeeChange = (name: string) => {
    onChange({
      employeeName: name,
      employeeRole: filer.employeePositionMap.get(name) ?? '',
      employeeBranch: filer.employeeBranchMap.get(name) ?? '',
    });
  };
```

In the JSX, where the Manager section was (first thing in the returned `<div>`):

```tsx
      {filer.email && filer.status !== 'loading' && filer.status !== 'filerError' && (
        <FilerBanner name={filer.filerName} email={filer.email} isAdmin={filer.isAdmin} count={filer.employees.length} />
      )}
```

In the Employee section, under its `Users` header row, where the label/hint/select were:

```tsx
        <EmployeePicker
          value={data.employeeName}
          employees={filer.employees}
          status={filer.status}
          error={errors.employeeName}
          onSelect={handleEmployeeChange}
        />
```

**Keep unchanged:** the Document Date section, the Job Title / Branch box, prior actions
(`getPriorActions`, `buildPriorWarningsSummary`, `PriorActionsPanel`), the follow-up banner,
Warning Level, Final Outcome, the hover helpers.

## 5. `src/app/utils/disciplinaryFormData.ts`

- Delete `export interface EmployeeInfo { … }` and the whole `export const EMPLOYEES: EmployeeInfo[] = [ … ];`
  list (40 names). Nothing else may reference them after §4.
- In `INITIAL_FORM`, replace
  `  documentDate: new Date().toISOString().split('T')[0],`
  with
  `  documentDate: '', // set to todayLocalYMD() when the form is created`
- Add, right above `INITIAL_FORM`:

```ts
// Today as YYYY-MM-DD in the browser's LOCAL time (Panama). Never toISOString():
// that is UTC, and after 7 pm in Panama it is already tomorrow.
export function todayLocalYMD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
```

Everything else in the file (types, warning levels, scenarios, evidence options, labels)
stays exactly as it is.

## 6. `src/app/pages/OfferLetterForm.tsx` — follow-up and date only

- Add `todayLocalYMD` to the existing `import { DisciplinaryFormData, INITIAL_FORM, … } from '@/app/utils/disciplinaryFormData';`
- Replace
  `  const [formData, setFormData] = useState<DisciplinaryFormData>(INITIAL_FORM);`
  with
  `  const [formData, setFormData] = useState<DisciplinaryFormData>(() => ({ ...INITIAL_FORM, documentDate: todayLocalYMD() }));`
- In `handleFollowUp`, replace
  `    const today = new Date().toISOString().split('T')[0];`
  with
  `    const today = todayLocalYMD();`
- In `handleFollowUp`, **delete** these three lines (the filer stays the signed-in user):

```tsx
      // Copy manager from prior action (so Step 1 is fully pre-filled)
      managerName: prior.manager_name ?? prev.managerName,
      managerEmail: prior.manager_email ?? prev.managerEmail,
```

Nothing else in this file changes in this prompt.

## Acceptance (on /dev, hard-refresh first)

1. **As Saul (admin):** no Manager Name / Manager Email boxes anywhere. The banner reads
   *Filing as Saul Fallembaum (saul.f@vitasyahc.com) · all employees*. The picker lists every
   current employee, and no one else.
2. The Document Date shows **today's Panama date**.
3. Choose an employee: Job Title and Branch fill in; prior actions load as before.
4. Click **Follow up** on a prior action: fields are pre-filled, the banner still shows Saul,
   and step 4's summary shows Saul as Manager.
5. Step 4 summary "Manager" / "Manager Email" show the filer (Saul / saul.f@…).
6. `grep` finds no `EMPLOYEES`, `FALLBACK_EMPLOYEES`, `managerInput` or `selectManager`
   anywhere in `src/app/`.
7. Byte sizes — each must be under 15 KB: `Step1EmployeeWarning.tsx`, `EmployeePicker.tsx`,
   `FilerBanner.tsx`, `useFilerScope.ts`, `disciplinaryFormData.ts`.
   (`OfferLetterForm.tsx` is already 15.4 KB; the next prompt brings it under.)
8. Lint clean; no runtime error banner.

## Report back

List every file you created, changed or deleted, with the byte size of each.
