# 09 — Disciplinary: a manager's browser downloads only their own people's cases

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these two files may change. No other file may be touched.**

- `src/actions/loadDisciplinaryActions.ts`
- `src/app/pages/disciplinary/DisciplinaryTable.tsx`

Do not create files. Do not touch any other action, lib, page, context or migration — in
particular not `loadDisciplinaryDueCount.ts`, `TopNav.tsx`, `lib/disciplinary.ts`,
`lib/mondayResolve.ts`, `lib/classificationEngine.ts`, `CaseFile.tsx`, `ActionDetail.tsx` or
`DisciplinaryRow.tsx`. Do not reformat, reorder or rename anything you are not asked to change.

## Why

The owner's rule: *managers see their own employees, that's all, not everyone.*

Today `DisciplinaryTable` asks for **every** case in the company
(`manager: null, employeeName: null`), with full narratives, and React hides the ones the
viewer may not see afterwards. The page looks right, but every manager's browser has already
received every case — anyone who opens the Network tab can read them.

`disciplinary_actions` lives in a **second database** (`SAUL Disciplinary Action Forms DB`). A
SQL action names one datasource, so this query **cannot** join `v_employee_access`, and the
rows carry only a typed `employee_name` (no id, no email). So the page must send the filter in:
the list of names the viewer may see. SQL keeps only cases whose name is on that list.
Viewers who see everyone (super users, and managers marked "all employees" — `allEmployees`
from `useViewer()`) send `allNames: true` and get everything, including names that match
nobody on the roster.

**Be plain about the limit.** This stops the everyday download: a manager using the app
normally no longer receives anyone else's cases. It **cannot** stop a determined person with
developer tools, because the second database has no way to know who is asking — the names
list comes from the browser, and someone could edit it or send `allNames: true` by hand. Real
enforcement would need the viewer check to run inside that database. That is a separate
project, not this prompt.

The existing JS filter (`visibleIds`, Stage 2) **stays**, as a second layer.

### The SQL filter must never hide a case the page would show

The page decides whose case it is with `buildResolver(emps, aliases, normalizeName)`: it
normalises the case's `employee_name` and matches it against an **alias** or a
**display name**. `normalizeName` lower-cases, strips accents, collapses runs of whitespace to
one space, and trims. So the list we send contains, for every employee the viewer may see,
their `display_name` **and every alias**, each passed through `normalizeName`. The SQL applies
the same normalisation to `employee_name` and keeps the row if it is on the list. Anything the
page would resolve to a visible employee is therefore returned.

## 1. `src/actions/loadDisciplinaryActions.ts`

The `SELECT` list does not change. Never add `pdf_en_base64` or `pdf_es_base64`.

Replace these three lines of the `WHERE` clause

```sql
      WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager_name = {{params.manager}})
        AND ({{params.employeeName}} IS NULL OR {{params.employeeName}} = '' OR employee_name = {{params.employeeName}})
        AND (COALESCE({{params.includeDeleted}}::boolean, false) OR deleted_at IS NULL)
```

with

```sql
      WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager_name = {{params.manager}})
        AND ({{params.employeeName}} IS NULL OR {{params.employeeName}} = '' OR employee_name = {{params.employeeName}})
        AND (COALESCE({{params.includeDeleted}}::boolean, false) OR deleted_at IS NULL)
        AND (COALESCE({{params.allNames}}::boolean, false)
             OR btrim(regexp_replace(
                  lower(translate(employee_name,
                    'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇÝáàâäãåéèêëíìîïóòôöõúùûüñçýÿ',
                    'AAAAAAEEEEIIIIOOOOOUUUUNCYaaaaaaeeeeiiiiooooouuuuncyy')),
                  '[[:space:]]+', ' ', 'g'))
                IN (SELECT jsonb_array_elements_text(COALESCE({{params.names}}::jsonb, '[]'::jsonb))))
```

Copy the two `translate` strings **exactly** — they are 53 characters each and pair up
position by position. Rules:

- `{{params.names}}` and `{{params.allNames}}` stand alone, cast, never inside quotes.
- Use `'[[:space:]]+'` for whitespace. **Do not write `\s`**: inside this backtick string
  JavaScript turns `\s` into the letter `s`, and the regex would then eat every "s" in a name.
- `translate` runs **before** `lower`, so accented capitals are handled without depending on
  the database locale.
- The `ORDER BY` line and everything else stay as they are.

## 2. `src/app/pages/disciplinary/DisciplinaryTable.tsx`

No import changes: `useMemo`, `useLoadAction`, `useViewer`, `normalizeName`,
`loadAllEmployeesAction`, `loadNameAliasesAction` and `loadVisibleEmployeeIdsAction` are all
already imported, and `allEmployees` / `isSuper` are already read from `useViewer()`.

### 2a. The data loads

Under `// ── Data loads ──…`, replace this block

```tsx
  const [rawRows, loading, error, reload] = useLoadAction(
    loadDisciplinaryActionsAction,
    [] as DisciplinaryRowType[],
    { manager: null, employeeName: null, includeDeleted: isSuper },
  );

  const [empsRaw] = useLoadAction(loadAllEmployeesAction, []);
  const [aliasesRaw] = useLoadAction(loadNameAliasesAction, []);
  const [visibleRaw, loadingVisible] = useLoadAction(
    loadVisibleEmployeeIdsAction,
    [] as { employee_id: number | string }[],
    { viewAs },
  );
  const visibleIds = useMemo(
    () => new Set((visibleRaw as { employee_id: number | string }[]).map(r => String(r.employee_id))),
    [visibleRaw],
  );
```

with

```tsx
  const [empsRaw, loadingEmps] = useLoadAction(loadAllEmployeesAction, []);
  const [aliasesRaw, loadingAliases] = useLoadAction(loadNameAliasesAction, []);
  const [visibleRaw, loadingVisible] = useLoadAction(
    loadVisibleEmployeeIdsAction,
    [] as { employee_id: number | string }[],
    { viewAs },
  );
  const visibleIds = useMemo(
    () => new Set((visibleRaw as { employee_id: number | string }[]).map(r => String(r.employee_id))),
    [visibleRaw],
  );

  // The disciplinary DB cannot join v_employee_access, so we send it every
  // spelling (display name + aliases) of the people this viewer may see,
  // normalised exactly like normalizeName. allNames skips it for supers.
  const scopeNames = useMemo(() => {
    const set = new Set<string>();
    for (const e of empsRaw as { id: number | string; display_name: string | null }[]) {
      if (e.display_name && visibleIds.has(String(e.id))) set.add(normalizeName(e.display_name));
    }
    for (const a of aliasesRaw as { employee_id: number | string; alias_text: string | null }[]) {
      if (a.alias_text && visibleIds.has(String(a.employee_id))) set.add(normalizeName(a.alias_text));
    }
    set.delete('');
    return JSON.stringify(Array.from(set).sort());
  }, [empsRaw, aliasesRaw, visibleIds]);
  const scopeReady = allEmployees || (!loadingVisible && !loadingEmps && !loadingAliases);

  const [rawRows, loading, error, reload] = useLoadAction(
    loadDisciplinaryActionsAction,
    [] as DisciplinaryRowType[],
    { manager: null, employeeName: null, includeDeleted: isSuper, allNames: allEmployees, names: scopeNames },
    { enabled: scopeReady },
  );
```

Notes, so nothing gets "improved" away:

- The disciplinary load **moves below** the three loads it depends on. That is intentional.
- Params go **flat** in the third argument. Never wrap them in `{ params: { … } }`.
- `{ enabled: scopeReady }` is the **fourth** argument, the same form `PayrollMaster.tsx`,
  `HrkSummary.tsx` and `TeramindCompare.tsx` already use. It holds the request back until the
  visible ids, the roster and the aliases have arrived, so a manager never fires a request with
  a half-built list. Viewers who see everyone do not wait.
- `names` is a **JSON string** (`JSON.stringify`), the same way `seen_ids` and `rows` are sent
  elsewhere, so the SQL can cast it with `::jsonb`.
- `allNames` is `allEmployees`, **not** `isSuper`: it must match the rule the Stage 2 filter
  already uses (`if (!allEmployees) …`), otherwise an "all employees" manager would lose the
  "not on roster" cases they see today.
- Compare ids as `String(...)` — BIGINTs can arrive as numbers or strings.

### 2b. The loading state

Replace

```tsx
  if (loading || (!allEmployees && loadingVisible)) {
```

with

```tsx
  if (loading || !scopeReady) {
```

so the table shows the spinner — not "No Employees Match" — while it is waiting.

### 2c. Everything else stays

The resolver, Stage 1, **Stage 2 including the `visibleIds` filter**, Stage 3, the counts
effect and the render do not change. `reload` still re-runs the load after a case is closed or
deleted.

## Not in this prompt (on purpose)

- `loadDisciplinaryDueCount` (the Disciplinary badge in `TopNav.tsx`) still counts due cases
  company-wide. It sends a number, not a narrative. Leave it.
- `loadAllEmployees` and `loadNameAliases` still send every employee's **name** to the
  browser. Names only, no case content. Leave them.

## Acceptance (observable on /dev → Disciplinary, DevTools Network tab open)

Before submitting, take a screenshot of the Disciplinary page as a super and as one manager
(view-as), so the tables can be compared after.

1. **As a super (no view-as):** the `loadDisciplinaryActions` request carries
   `allNames: true`; its response has **all N cases** in the table (write N in the commit
   message), including any "not on roster" names. The page looks exactly as it did before.
2. **Viewing as a manager** who has people with cases: the request carries `allNames: false`
   and a `names` list of that manager's people (display names and aliases, lower-case, no
   accents). The response contains **only** cases whose employee belongs to that manager —
   no other team's case appears anywhere in the response. The table is identical to the
   "before" screenshot for that manager.
3. **Viewing as a manager with no cases:** the response is `[]` and the page shows the empty
   state, not a spinner forever.
4. No request for `loadDisciplinaryActions` is sent from a manager view before the names list
   is ready (there is no response containing other teams' cases, even for an instant).
5. Closing or deleting a case still refreshes the table.
6. Lint clean. Report the byte size of both files; each must stay under 15 KB
   (`DisciplinaryTable.tsx` is about 13.4 KB after this change).
7. `git status --short` after export shows only the two files above.
8. `node --test tests/disciplinaryScope.test.ts` passes (7 tests), and the full suite passes.
