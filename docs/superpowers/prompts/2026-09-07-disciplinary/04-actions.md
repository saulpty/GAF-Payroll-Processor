# Create four actions against the disciplinary database

**Create exactly these four new files, and nothing else:**

- `src/actions/loadDisciplinaryActions.ts`
- `src/actions/loadDisciplinaryDueCount.ts`
- `src/actions/updateDisciplinaryActionClosed.ts`
- `src/actions/updateDisciplinaryActionReopened.ts`

**No other file may be created, modified or deleted.** Do not touch any page,
any component, `app.tsx`, `TopNav.tsx`, `FilterBar.tsx`,
`src/app/lib/disciplinary.ts`, or any existing action. Do not write a migration.
Nothing imports these yet, and that is expected.

## The datasource — this is the unusual part

These four actions do **not** use `GAF Planilla DB`. They target the separate
database connected to this app as:

```
SAUL Disciplinary Action Forms DB
```

Use that exact string as `datasourceName` in all four files. `src/actions/pullMondayBoard.ts`
is the precedent that an action may name a datasource other than the primary one.

**Do not change any existing action's datasource.** In particular, leave
`Monday.com API v2` alone — it is connected but referenced by nothing, and
`src/AGENTS.md` says not to switch an action to it.

## Two rules that have each cost this project a day

**1. `{{params.x}}` is substituted as a whole value, never as a fragment inside a
string.** On 2026-08-11 a `{{params.boardId}}` placed inside a quoted string
reached Monday.com verbatim and Directory Sync silently returned zero employees.
Write `{{params.manager}}`, never `'{{params.manager}}'` and never
`'%{{params.manager}}%'`. Casts go **outside** the braces: `{{params.id}}::bigint`.

**2. Never `SELECT *` on `disciplinary_actions`.** It has two columns,
`pdf_en_base64` and `pdf_es_base64`, holding entire PDF documents as base64. One
row is roughly 250 KB. **Neither column may appear in any of these four
actions.** Select the explicit list below.

---

## 1. `src/actions/loadDisciplinaryActions.ts`

Every disciplinary action, for the viewer page.

```ts
import { action } from '@uibakery/data';

function loadDisciplinaryActions() {
  return action('loadDisciplinaryActions', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT id,
             ref,
             manager_name,
             manager_email,
             employee_name,
             employee_role,
             employee_branch,
             document_date::text        AS document_date,
             revaluation_date::text     AS revaluation_date,
             warning_level,
             final_outcome,
             scenario,
             q_expected,
             q_happened,
             q_when,
             q_impact,
             evidence_types,
             evidence_description,
             prior_warnings,
             expectations,
             consequences,
             signature_drawn,
             closed_at::text            AS closed_at,
             closed_by,
             closure_note,
             submitted_at::text         AS submitted_at
      FROM disciplinary_actions
      WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager_name = {{params.manager}})
        AND ({{params.employeeName}} IS NULL OR {{params.employeeName}} = '' OR employee_name = {{params.employeeName}})
      ORDER BY employee_name, document_date DESC, id DESC;
    `,
  });
}

export default loadDisciplinaryActions;
```

Write it exactly as above. Notes on why, so nothing is "tidied":

- **`::text` on all four date columns.** Postgres hands back full timestamps
  otherwise, and this codebase has roughly ten migrations that are all
  successive fixes to the same timezone bug.
- **The three-way null guard** on each filter is the idiom already used by
  `loadContractMilestones.ts` and `loadPtoBalancesInputs.ts`. It lets the page
  pass `null` for "no filter".
- **`employeeName`, not `employeeId`.** That database has no employee id and no
  email — only a free-text name. This is also the parameter the future Employee
  360 page will pass.
- **`ORDER BY … id DESC`** — two actions can share a `document_date` and an
  identical `submitted_at`, so `id` is the only thing that separates them.

## 2. `src/actions/loadDisciplinaryDueCount.ts`

One number, for the red count on the nav button. Same shape as
`loadContractsExpiringCount.ts`.

```ts
import { action } from '@uibakery/data';

function loadDisciplinaryDueCount() {
  return action('loadDisciplinaryDueCount', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT COUNT(*)::int AS count
      FROM disciplinary_actions
      WHERE closed_at IS NULL
        AND revaluation_date IS NOT NULL
        AND revaluation_date <= ({{params.asOf}}::date + 30);
    `,
  });
}

export default loadDisciplinaryDueCount;
```

- It takes `asOf` from the caller rather than using `CURRENT_DATE`, so the badge
  and the page can never disagree about what day it is. The page computes today
  with `toLocalYMD(new Date())`; the database server's own date may be a
  different calendar day.
- **There is no lower bound, on purpose.** An already-overdue case keeps being
  counted rather than ageing out of the badge and disappearing, which would be
  the opposite of what this page is for.
- `COUNT(*)::int AS count` so the caller reads `[0].count` as a number.

## 3. `src/actions/updateDisciplinaryActionClosed.ts`

Records that a case has been closed.

```ts
import { action } from '@uibakery/data';

// Closes one disciplinary action. The `closed_at IS NULL` guard makes this
// idempotent: a second click cannot overwrite the first closure's author or note.
function updateDisciplinaryActionClosed() {
  return action('updateDisciplinaryActionClosed', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET closed_at    = NOW(),
          closed_by    = {{params.closedBy}},
          closure_note = {{params.note}}
      WHERE id = {{params.id}}::bigint
        AND closed_at IS NULL
      RETURNING id, ref, closed_at::text AS closed_at, closed_by, closure_note;
    `,
  });
}

export default updateDisciplinaryActionClosed;
```

- **`AND closed_at IS NULL` is required.** Without it a double-click would
  silently replace who closed the case and why.
- It updates **only** those three columns. It must never touch
  `warning_level`, `final_outcome`, `revaluation_date`, or any narrative column.
- No `DELETE` anywhere in this file.

## 4. `src/actions/updateDisciplinaryActionReopened.ts`

Undoes a closure.

```ts
import { action } from '@uibakery/data';

// Reopens one disciplinary action by clearing all three closure columns.
// Closure is the only write this app performs against the disciplinary
// database, so a misclick must be reversible.
function updateDisciplinaryActionReopened() {
  return action('updateDisciplinaryActionReopened', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET closed_at    = NULL,
          closed_by    = NULL,
          closure_note = NULL
      WHERE id = {{params.id}}::bigint
      RETURNING id, ref;
    `,
  });
}

export default updateDisciplinaryActionReopened;
```

All three columns are cleared together — a row with a `closed_by` but no
`closed_at` would be a state the viewer cannot render.

---

## Acceptance — observable outcomes

1. Exactly four new files exist, all under `src/actions/`. `git status` shows
   nothing else.
2. All four name `SAUL Disciplinary Action Forms DB`. No existing action's
   `datasourceName` changed.
3. **Neither `pdf_en_base64` nor `pdf_es_base64` appears anywhere in the four
   files.**
4. No `{{params.…}}` anywhere sits inside a quoted string.
5. Running `loadDisciplinaryActions` with `manager` and `employeeName` both null
   returns every row, each with `document_date`, `revaluation_date`, `closed_at`
   and `submitted_at` as plain strings — and `document_date` reading exactly
   `2026-06-23`, ten characters, not a timestamp.
6. Running it with `manager` set to `Marcela Gordon` returns only that manager's
   rows.
7. Running `loadDisciplinaryDueCount` with `asOf` set to today returns a single
   row with a numeric `count`. With every case currently open and every
   re-evaluation date in the past, that number equals the total row count.
8. `updateDisciplinaryActionClosed` and `updateDisciplinaryActionReopened`
   contain no `DELETE`, no `DROP`, and no `TRUNCATE`, and neither writes any
   column other than the three closure columns.

Report the row count and the first row returned by `loadDisciplinaryActions`,
and the number returned by `loadDisciplinaryDueCount`. **Do not run either write
action** — they will be exercised from the page once it exists.

---

# Results — 2026-09-07

**Four files added, nothing else.** `sync-export.mjs` reported
`added: 4, changed: 0, removed: 0`, and `git status` showed exactly the four
action files.

| check | result |
|---|---|
| `pdf_en_base64` / `pdf_es_base64` anywhere in the four files | **0 hits** |
| `DELETE` / `DROP` / `TRUNCATE` | **0 hits** |
| test L2 — no `{{params.x}}` inside a quoted string | **passes** |
| `datasourceName` in all four | `SAUL Disciplinary Action Forms DB` |
| largest file | 1 380 bytes |

A first grep for params-in-quotes reported two hits; both were the legitimate
three-way null guard, where the `''` is an empty-string literal next to a bare
`{{params.manager}}`. **The L2 test is the authority, not a hand-rolled grep** —
it passed.

## The datasource question is now settled by evidence

`loadDisciplinaryActions` was executed against the live database and returned
**`data: Array[16]`**; `loadDisciplinaryDueCount` returned `Array[1]`.

So **`'SAUL Disciplinary Action Forms DB'` is correct** — proved by a real query
returning the same 16 rows the probes counted, not by reasoning about
`datasources.yml`. The `GA Offer Letter DB v2` line in the export remains
unexplained but is demonstrably not the string an action needs.

## A correction to this prompt's own wording

This prompt said *"`::text` on all four date columns. Postgres hands back full
timestamps **otherwise**"*. The word "otherwise" is wrong, and the round proved
it: `document_date::text AS document_date` still arrives as
`2026-06-24T00:00:00.000Z`, because **the driver re-serializes the cast result
on the way out.**

The cast is worth keeping — it costs nothing and documents intent — but it is
**not** a substitute for slicing at the point of use. `LESSONS.md` already
carried this under "Postgres returns dates as full timestamps"; it now also
carries the mechanism and the trap:

> `'2026-10-07T00:00:00.000Z' <= '2026-10-07'` is **false**, because the longer
> string sorts after. An unsliced `<=` silently drops the boundary day.

`disciplinary.ts` is unaffected — prompt `03` already requires `.slice(0, 10)`
on every date it reads, in every comparison.

## Deliberately not answered

The run ended with UI Bakery offering to *"build the full page with a table,
filters, close/reopen actions"* in one go. **Declined by simply not replying** —
that is precisely the bundled change `CHANGE-LOOP.md` warns produces an
unreviewable diff, and it would ignore the file-size split the design specifies.
The next prompt sent is `03-disciplinary-lib.md`, which answers it implicitly.
