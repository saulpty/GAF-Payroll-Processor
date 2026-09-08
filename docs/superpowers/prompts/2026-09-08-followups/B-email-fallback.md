# Make `rowMatchesEmp` fall back to the name when the email belongs to nobody

Change **one function** in **one file**. Change no other file.

> **This file is protected.** `src/app/lib/classificationEngine.ts` is on the
> untouchable payroll list in `CLAUDE.md`. This change is being made **only
> because Saul explicitly asked for it**, after reading
> `docs/findings/2026-09-08-form-email-mismatch.md`. Do not take it as licence to
> touch anything else in the payroll engine, and do not "improve" adjacent code.

## Why this is urgent

`rowMatchesEmp` (`classificationEngine.ts:391-405`) short-circuits on line 400:

```ts
if (rowEmail && rowEmail.trim()) {
  return rowEmail.trim().toLowerCase() === empEmail.toLowerCase();
}
```

When a Monday row carries an email, that email is the **only** test. The alias
and display-name paths below it are unreachable. So a form filed from any address
other than the person's `employees.teramind_email` matches nobody, and every
payroll run behaves as if the form does not exist.

**113 attendance forms across 24 employees are in that state.** The most recent
is dated 2026-09-02. The addresses are mundane and will keep recurring:
`vitasya.com` for `vitasyahc.com`, `gaboc@` for `gabo.c@`, a transposed letter,
a personal gmail.

The same function gates four collections — `absenceForms` (line 512),
`tardinessForms` (515), `adjustments` (518) and `permissions` (521) — so a
mismatch hides a sick note, a Time-for-Time hold and an approved PTO day equally.
The costs, all silent, no error, no warning:

- An approved paid day off falls through Step 2 to **Step 5** and is written as
  RED `Ausencia Injustificada` with `discount_total_minutes = 420` (line 653).
- An absence form on file does the same — **7 paid hours docked** on a day that
  should have been YELLOW `Ausencia Justificada.` with zero discount.
- A grace-list employee 9 minutes late **with** a form should be `Paid (Grace)`,
  0 minutes docked (line 708). With the form invisible they get
  `Unpaid (without Grace)` and lose 9 minutes — on a **GREEN** row, which
  `computeDerivedFields` marks `payroll_ready = YES`, so no operator ever sees it.
- `documentation` is never set to `'Attendance Form'` (line 742), so
  `v_attendance_daily` buckets the day as **"Late – Unreported"** and the
  Attendance dashboard shows a diligent employee as one who never files.

The mirror's own resolver, `src/app/lib/mondayResolve.ts` `buildResolver`,
already resolves email → alias → normalized name without short-circuiting. Its
header comment claims it matches `rowMatchesEmp`'s order. It does not, and that
disagreement is this bug. **This change makes the engine agree with the
resolver.**

## The rule this must NOT weaken

The early return exists for a good reason: an email match is authoritative, and
it prevents two people with similar names being confused. Keep that.

The distinction the new code turns on:

- The email belongs to **a different employee on the roster** → the row is that
  person's row. **Return false. Do not fall back to the name.** Falling back here
  would be a mis-assignment — actively worse than today's miss.
- The email belongs to **nobody on the roster** → it is a typo or a personal
  address and carries no information at all. Falling back to the name is safe,
  and is what `buildResolver` already does.

Telling those two apart needs the whole roster. `rowMatchesEmp` today sees one
employee at a time and is called inside `.filter()`.

## How the roster reaches the function

**Derive a lowercase email set inside `runClassificationEngine` and pass it as a
seventh argument.** Do not add a field to `EngineInput`.

Reason: `EngineInput.employees` is already the full active roster
(`ProcessPayroll.tsx:98` loads every active, non-excluded employee, and
`singleEmpMode` filters the engine's *output* at line 449, not its input). A new
input field would have to be constructed by `ProcessPayroll.tsx` and by all four
test files, and could drift out of agreement with `employees`. Deriving it inside
the engine makes that impossible and changes **zero call sites outside this
file**.

Build it once, immediately after the `cfg` line (currently line 418), before the
`for (const emp of employees)` loop:

```ts
// Every teramind_email on the roster, lowercased. Used by rowMatchesEmp to tell
// "this email belongs to someone else" (authoritative: no match, no fallback)
// from "this email belongs to nobody" (a typo: fall back to the name).
const rosterEmails = new Set(
  employees
    .map(e => (e.teramind_email ?? '').trim().toLowerCase())
    .filter(Boolean)
);
```

Then pass `rosterEmails` as the seventh argument at **all four** call sites —
lines 512, 515, 518 and 521. All four, or the boards disagree with each other.

## The new function

Replace lines 391-405 with exactly this, comment included:

```ts
/** Returns true if this Monday row belongs to the given employee.
 *  Order: email-first, then alias resolution via nameMap, then direct name match.
 *  nameMap (normalized name -> employee id, built from display_name + aliases) is
 *  what lets board rows that use a name variant still attach to the right person.
 *
 *  The email is the FIRST test, not the ONLY test (changed 2026-09-08). An email
 *  that matches this employee wins outright, and an email belonging to a
 *  DIFFERENT roster employee loses outright -- that row is the other person's and
 *  must never fall through to a name comparison. But an email that belongs to
 *  nobody on the roster carries no information (a typo, a dropped domain suffix,
 *  a personal gmail), so the name and alias paths still get their turn. 113 forms
 *  were invisible to payroll because they did not.
 *  See docs/findings/2026-09-08-form-email-mismatch.md. */
function rowMatchesEmp(
  rowEmail: string | undefined,
  rowName: string,
  empEmail: string,
  empName: string,
  empId?: number,
  nameMap?: Map<string, number>,
  rosterEmails?: Set<string>,
): boolean {
  const em = (rowEmail ?? '').trim().toLowerCase();
  if (em) {
    // Authoritative match: this row is this employee's.
    if (em === (empEmail ?? '').trim().toLowerCase()) return true;
    // Authoritative non-match: the email is someone else's on the roster.
    if (rosterEmails && rosterEmails.has(em)) return false;
    // Without a roster set, preserve the historic strict behaviour.
    if (!rosterEmails) return false;
    // Otherwise the email resolves to nobody -- fall through to name/alias.
  }
  const norm = normalizeName(rowName ?? '');
  if (!norm) return false;
  if (nameMap && empId !== undefined && nameMap.get(norm) === empId) return true;
  return norm === normalizeName(empName);
}
```

Three details that are deliberate, not incidental:

- **`if (!rosterEmails) return false;`** keeps the old behaviour exactly when the
  parameter is omitted. The engine always passes it; this is a safety net so an
  omitted argument fails closed, never open.
- **`if (!norm) return false;`** stops a row with a blank name from matching an
  employee with a blank `display_name`. No such employee exists today, and the
  guard costs nothing.
- **`(empEmail ?? '').trim()`** — the old line called `.toLowerCase()` on
  `empEmail` without trimming. A roster address with a trailing space would fail
  to match its own form. Trim both sides.

## Decision table — the exact new behaviour

| Email on the row | On the roster? | Result | Changed? |
|---|---|---|---|
| Blank, or whitespace only | — | Name path: alias via `nameMap`, then normalized `display_name` | No |
| Equals this employee's `teramind_email` (case- and whitespace-insensitive) | Yes, this employee | **Match** | No |
| Some other employee's `teramind_email` | Yes, a different employee | **No match, and no name fallback** | No — and this is the safety guarantee |
| Not on the roster at all, row name resolves to this employee | No | **Match** | **Yes — this is the fix** |
| Not on the roster at all, row name resolves to nobody | No | No match | No (same outcome, new path) |
| Not on the roster, row name blank | No | No match | No |

The only cell that changes is row 4.

## Known limitation — state it, do not try to fix it

If two **active** employees normalize to the same display name, a row with an
unknown email and that name matches **both**, exactly as a row with a blank email
already does today. That weakness is pre-existing in the name path; this change
makes it reachable more often. It is out of scope here. `name_aliases` and the
duplicate-employee cleanup in
`docs/findings/2026-09-01-euclides-gonzalez-duplicate-employee.md` are where that
gets addressed. **Do not add de-duplication logic to this function.**

## Acceptance

1. `src/app/lib/classificationEngine.ts` is the **only** file changed. No action,
   no page, no component, no migration, no `AGENTS.md`, no test.
2. `rowMatchesEmp` takes a seventh optional parameter `rosterEmails?: Set<string>`
   and behaves exactly as the decision table above.
3. `rosterEmails` is built once inside `runClassificationEngine` from
   `input.employees`, before the employee loop, and is **not** a new
   `EngineInput` field.
4. All four call sites — lines 512, 515, 518, 521 — pass it.
5. Nothing else in the file is touched. In particular: the non-scheduled-day gate
   (lines 448-475), `permissionCoversDate` (407), `computeDiscount` (243) and
   every Step block are byte-for-byte unchanged.
6. `node --test "tests/*.test.ts"` passes. Baseline is 104 and no existing test
   should change result — every one of them uses either a blank email or an email
   that matches its employee, both of which are unchanged paths.
7. The file stays under 15 KB is **not** applicable here (it is already over and
   this change adds ~12 lines); do not split the file as part of this change.

## Notes — tests Saul writes by hand afterwards

Not part of this prompt. UI Bakery must not create or modify anything under
`tests/`. Suggested file: `tests/emailFallback.test.ts`, in the style of
`tests/mondayResolve.test.ts` (small fixtures, one behaviour per test, a comment
block at the top saying why the file exists) and `tests/weekendSchedule.test.ts`
(an `emp()` / `baseInput()` pair driving the whole engine).

Two employees are needed in the roster for the adversarial cases:

```
id 1  Gabriel Chu   gabo.c@vitasyahc.com
id 2  Gabriela Chu  gabriela.c@vitasyahc.com
```

Regression cases — must pass before *and* after the change:

- **E1** Row email equals the employee's own address → matches. The unchanged
  authoritative path.
- **E2** Same, with different casing and surrounding whitespace on both the row
  and the roster value (`'  GABO.C@VitasyaHC.com '`) → still matches.
- **E7** Row email blank, row name equals `display_name` → matches.
- **E8** Row email is whitespace only (`'   '`) → treated as blank, name path
  runs.

Adversarial cases — the ones that prove the fallback did not weaken anything:

- **E3 (the important one)** Row email is `gabriela.c@vitasyahc.com` — a real
  roster address — while the row *name* says "Gabriel Chu". Assert **both**
  directions: it does **not** attach to Gabriel (id 1), and it **does** attach to
  Gabriela (id 2). One form, one employee, and the email wins. If only the first
  half is asserted, a function that matches nobody would pass.
- **E6** Row email `nobody@example.com`, row name "Somebody Nobody" → matches no
  employee. The day still classifies through Step 5 exactly as before.
- **E11** Two active employees with the same normalized `display_name` and an
  unknown email on the row → documents that it attaches to both. This test pins
  current behaviour so the limitation is visible in the suite rather than
  discovered in a payroll run; write it as a `// KNOWN LIMITATION` test, not as
  an aspiration.

The fix cases:

- **E4** Row email `gabo.c@vitasya.com` (not on the roster), row name
  "Gabriel Chu" → matches id 1. The literal 113-form case.
- **E5** Same unknown email, row name is an alias present in `nameMap` mapping to
  id 1 → matches id 1. Proves the alias path is reachable now, not just
  `display_name`.

The money cases — run the whole engine, assert the payroll numbers, not the
matcher:

- **E9** Grace-list employee, `grace_minutes: 10`, punches in 9 minutes late, a
  **Tardiness** form on file under `gabo.c@vitasya.com`. Assert
  `pay_impact_1 === 'Paid (Grace)'`, `discount_total_minutes === 0`,
  `documentation === 'Attendance Form'`, `initial_status === 'GREEN'`. Before the
  change this row is `Unpaid (without Grace)` with 9 minutes docked — so this
  test fails before and passes after, which is what makes it worth writing.
- **E10** No punches, an **Absence** form on file under an unknown email. Assert
  Step 3, not Step 5: `event_type_1 === 'Ausencia Justificada.'`,
  `discount_total_minutes === 0`, `initial_status === 'YELLOW'`. Before the change
  this is RED `Ausencia Injustificada` with 420 minutes docked.
- **E12** No punches, a full-day **PTO permission** on the permissions board under
  an unknown email. Assert Step 2: `event_type_1 === 'PTO'`,
  `pay_impact_1 === 'Paid'`, `discount_total_minutes === 0`. Same shape as E10,
  through a different board — it proves the seventh argument was passed at line
  521 and not only at 512.

One thing these tests must **not** assert: anything about off-day rows. The
non-scheduled-day gate runs before every form lookup and keys on punches, and
`weekendSchedule.test.ts` W2/W3/W9/W11 already own that ground.

---

## Addendum — added 2026-09-08, apply together with the above

### The tests already exist and are red

`tests/emailFallback.test.ts` is written and committed. **Do not edit it.** Make
it pass. Thirteen cases; seven already pass and must stay passing:

- **E1, E2, E3, E6, E7, E8, E8b pass today.** E3 is the important one — a row
  carrying employee B's address but naming employee A must attach to B and NOT
  to A. It asserts both directions. If your change breaks E3 it has weakened the
  authoritative match, which is worse than the bug.
- **E4, E5, E9, E10, E11, E12 fail today** and must pass afterwards. E11 goes
  through the **permissions** board specifically, so a fix applied only to the
  attendance lookups will pass everything else and still fail there — that is
  deliberate.

Run `node --test "tests/emailFallback.test.ts"` mentally against your change
before you finish: 13 of 13.

### One cosmetic fix, same pass

In `src/app/pages/attendance/AttendanceTable.tsx`, the new `Reporting` badge
renders `Complete 8/8` too narrow, so the numbers stack vertically inside the
pill. Give the badge enough width, or put the ratio outside the pill next to it,
so it reads on one line at every count. **No other change to that file.**

### Files you may change

- `src/app/lib/classificationEngine.ts` — the matcher and the roster set only
- `src/app/pages/attendance/AttendanceTable.tsx` — the badge width only

**No other file.** Not the tests, not a migration, not another page.
