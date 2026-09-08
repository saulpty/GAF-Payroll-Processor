# 113 forms are invisible to payroll because the email on them is one letter off

Written 2026-09-08. Read-only analysis of the mirror and the engine source; no
code, data or configuration was changed.

Follows on from
`docs/superpowers/prompts/2026-09-07-attendance-reports/00ef-absence-form-miss-RESULTS.md`,
which found this while chasing something else.

**Short version.** When an attendance form carries an email address, the payroll
engine tests *only* that address. It never falls back to the name or to
`name_aliases`. So a form filed from any address other than the one on the
roster matches nobody, and every payroll run behaves as though the form does not
exist. **113 forms across 24 employees are in that state**, one of them filed
five days ago.

---

## The mechanism

`src/app/lib/classificationEngine.ts:391-405`:

```ts
function rowMatchesEmp(
  rowEmail: string | undefined,
  rowName: string,
  empEmail: string,
  empName: string,
  empId?: number,
  nameMap?: Map<string, number>,
): boolean {
  if (rowEmail && rowEmail.trim()) {
    return rowEmail.trim().toLowerCase() === empEmail.toLowerCase();
  }
  const norm = normalizeName(rowName);
  if (nameMap && empId !== undefined && nameMap.get(norm) === empId) return true;
  return norm === normalizeName(empName);
}
```

Line 400 is an **early return, not a first attempt**. The alias and name paths on
lines 402-404 are unreachable for any row that has an email at all. They only run
for rows with a blank email column.

That function is the sole gate on all four Monday boards the engine reads —
`classificationEngine.ts:512, 515, 518, 521`:

| Line | Collection | Board |
|---|---|---|
| 512 | `absenceForms` | Attendance forms, `type = 'Absence'` |
| 515 | `tardinessForms` | Attendance forms, `type = 'Tardiness'` |
| 518 | `adjustments` | Time adjustments (TFT) |
| 521 | `permissions` | Permissions (PTO, vacation, WFH, unpaid leave) |

An email mismatch therefore hides a form, a time adjustment and an approved paid
day off with equal thoroughness.

### Why nobody noticed

`src/app/lib/mondayResolve.ts` `buildResolver` — the resolver the *mirror* uses,
and the one behind the admin Monday tab, the Reconciliation table and the
Disciplinary page — resolves in three steps and does not short-circuit:

```ts
if (em && byEmail.has(em)) return byEmail.get(em)!;
if (nm && byAlias.has(nm)) return byAlias.get(nm)!;
if (nm && byName.has(nm)) return byName.get(nm)!;
return null;
```

Its own header comment claims "Order is the same as the classification engine's
`rowMatchesEmp`". **It is not.** `buildResolver` treats email as the *first*
test; `rowMatchesEmp` treats it as the *only* test.

The consequence is the worst possible failure shape: these 113 forms show as
correctly matched to the right person in `monday_attendance_forms` and on every
screen that reads the mirror, while being simultaneously unseen by every payroll
run. Nothing errors. Two code paths quietly disagree, and only one of them
touches money.

---

## The 15 known rows, by failure pattern

The source table lists 15 employee/address pairs covering 72 of the 113 forms.
The remaining 41 forms belong to the other 11 of the 24 employees and are not
itemised.

### Pattern 1 — wrong company domain (44 forms)

The local part is exactly right; the address is at a real sister-company domain.

| Employee | Roster | On the form | Forms |
|---|---|---|---|
| Juan Molina | `juan.molina@vitasyahc.com` | `juan.molina@passiontocarehc.com` | 34 |
| Arelis Acosta | `arelis.a@vitasyahc.com` | `arelis.a@passiontocarehc.com` | 7 |
| Reggina Sandoval | `gigi.s@vitasyahc.com` | `gigi.s@avondalecaregrouppa.com` | 3 |

**This pattern is not a typo, and a code fix is the wrong answer for it.** Every
one of Juan Molina's 34 forms uses the *same* alternate domain, consistently,
across 2026-05-15 → 07-09. That is the signature of a person who moved company
and a roster that was never updated — not of someone fat-fingering an address 34
times. Same for Arelis Acosta's 7 and Reggina Sandoval's 3.

These three need someone to look at the Panama Employee Directory and answer:
*which domain is this person actually at today?* If the answer is the one on the
forms, `employees.teramind_email` is stale, and a name fallback would paper over
a roster error rather than fix it. It would also leave their **Teramind punches**
mismatched, which the fallback cannot help with at all — `teramindData` is keyed
by `emp.teramind_email` (lines 455, 490) with no name path anywhere.

### Pattern 2 — corporate suffix dropped from the domain (11 forms)

`vitasyahc.com` → `vitasya.com`; `passiontocarehc.com` → `passiontocare.com`.

| Employee | Roster | On the form | Forms |
|---|---|---|---|
| Aleka Papatsoris | `ally.p@passiontocarehc.com` | `ally.p@passiontocare.com` | 3 |
| Navvad Owusu | `navvad.o@passiontocarehc.com` | `navvad.o@passiontocare.com` | 2 |
| Elizabeth Mootoo | `ely.m@vitasyahc.com` | `ely.m@vitasya.com` | 2 |
| Alanis Chena | `alanis.c@vitasyahc.com` | `alanis.c@vitasya.com` | 2 |
| Gabriel Chu | `gabo.c@vitasyahc.com` | `gabo.c@vitasya.com` | 2 |

Five different people making the identical mistake is not five accidents. The
company is known by the short name and the mail domain carries an `hc` that
nobody says out loud. This will recur indefinitely.

### Pattern 3 — domain typo (4 forms)

| Employee | Roster | On the form | Forms |
|---|---|---|---|
| Arelis Acosta | `arelis.a@vitasyahc.com` | `arelis.a@vistasyahc.com` | 2 |
| Lilian Barría | `lili.b@passiontocarehc.com` | `lili.b@pasaiontocarehc.com` | 2 |

`vistasyahc` (transposed `s`), `pasaiontocarehc` (transposed `si`). One of
Arelis Acosta's is dated **2026-09-02**.

### Pattern 4 — different local part, right domain (9 forms)

| Employee | Roster | On the form | Forms |
|---|---|---|---|
| Gabriel Chu | `gabo.c@vitasyahc.com` | `gaboc@vitasyahc.com` | 4 |
| Edwin Broce | `edwin.b@passiontocarehc.com` | `e.broce@passiontocarehc.com` | 3 |
| Monique Luque | `monique.l@passiontocarehc.com` | `monique.luque@passiontocarehc.com` | 2 |

People typing the address they *think* they have. Note Gabriel Chu appears in
three separate patterns (4 + 2 forms here and in pattern 2) — he has been getting
his own address wrong three different ways since March.

### Pattern 5 — personal address (4 forms)

| Employee | Roster | On the form | Forms |
|---|---|---|---|
| Natalia Esquivel | `nati.e@passiontocarehc.com` | `nati16esquivel@gmail.com` | 2 |
| Jose Navarro | `jose.n@passiontocarehc.com` | `jose_navarro80@yahoo.com` | 2 |

Filed from a phone, from home, on a sick day — exactly the circumstance in which
an absence form gets filed. No amount of domain-matching cleverness reaches
these; only the name does.

### What a code fix catches, and what it does not

The pattern taxonomy above is useful for understanding *why* this keeps
happening, but it is **not** what decides whether a name fallback rescues a given
form. Two things decide that:

1. **Is the wrong address unknown to the roster?** If it belongs to no employee,
   falling back to the name is safe. If it belongs to a *different* employee, the
   row is that person's and falling back would be a mis-assignment — worse than
   the current miss.
2. **Does the name on the row resolve?** Via `name_aliases` or a normalized
   `display_name` match.

| Pattern | Rescued by a name fallback? |
|---|---|
| 2 — suffix dropped | **Yes.** `vitasya.com` is nobody's address. |
| 3 — domain typo | **Yes.** `vistasyahc.com` is nobody's address. |
| 4 — different local part | **Yes**, unless `e.broce@passiontocarehc.com` is a real second mailbox for someone else on the roster. |
| 5 — personal address | **Yes.** Gmail and Yahoo are nobody's roster address. |
| 1 — wrong company domain | **Yes mechanically, but it is the wrong fix.** These need the roster corrected. And the fallback does nothing for their Teramind punches. |

**One prerequisite is unmeasured.** I did not verify that the mismatched rows
carry a usable `employeeName`. Every rescue depends on it, and the 00ef results
already record one name discrepancy in this data ("Ozzy Medina" on the board vs
"Osvaldo Medina" on the roster — resolvable, but only if an alias exists). Before
committing to the code route, run:

```sql
SELECT employee_name, employee_email, COUNT(*)
FROM monday_attendance_forms f
WHERE NOT EXISTS (
  SELECT 1 FROM employees e
  WHERE LOWER(TRIM(e.teramind_email)) = LOWER(TRIM(f.employee_email))
)
GROUP BY 1, 2 ORDER BY 3 DESC;
```

and check each name against `employees.display_name` and `name_aliases`.

**There is no place to record a second address.** `name_aliases` holds
`alias_text` only — names. `employees` has one `teramind_email` and one
`company_domain`. An email-alias route would need a new table and a change to
both resolvers; it is strictly more work than the name fallback and buys the same
outcome.

---

## What it costs to leave this alone

Every payroll behaviour below is gated on `rowMatchesEmp` returning true. When it
returns false, the engine does not error, does not warn, and does not leave a
row half-finished. It produces a **complete, confident, wrong answer**.

### 1. An approved paid day off becomes an unexcused absence — 7 hours docked

Step 2 (`classificationEngine.ts:545-582`) reads `permissions`, built at line 521
through the same matcher. A PTO, vacation, floating-holiday or compensatory-day
row whose email mismatches is not found. The day is not a holiday, has no visible
absence form and has no Teramind punches — so control reaches **Step 5**
(line 643):

```ts
event_type_1: 'Ausencia Injustificada',
auto_notes: 'NO DATA + NO FORM (Suggested: Unpaid)',
initial_status: 'RED',
entry.discount_total_minutes = cfg.full_day_absence_discount_minutes;  // line 653
```

`full_day_absence_discount_minutes` defaults to **420 — seven paid hours**
(line 347). An approved day off becomes a RED unexcused absence with seven hours
deducted. This is the largest single loss in the engine.

### 2. An absence form on file becomes an unexcused absence — 7 hours docked

Step 3 (line 583). Seen, the day is `Ausencia Justificada.`, YELLOW,
`documentation` = `Attendance Form` or `Doctor Note – Pending`, and
**`discount_total_minutes` is 0** — `computeDiscount` (line 261) only applies a
full-day deduction when `pay_impact` is literally `'Unpaid'`, and Step 3 leaves
`pay_impact_1` blank for the operator.

Not seen, the same day falls to Step 5 and is docked **420 minutes**. Nothing
distinguishes it from a genuine no-show.

Two further behaviours vanish with it:

- **The conflict check** (line 594). Absence form filed *and* Teramind shows
  activity → RED with `⚠ CONFLICT` in `auto_notes`. A real contradiction — a form
  saying "absent", punches saying "present" — goes completely unflagged.
- **The partial medical note split** (line 606). A `Constancia Médica` covering
  part of a day is parsed out of the form notes and the remainder split into
  slot 2. Invisible form, no split.

### 3. A pardoned lateness is docked, silently, and no operator ever sees it

The grace rule, lines 705-721. `emp.is_grace_list` employees only.

| Situation | Form seen | Form invisible |
|---|---|---|
| Late ≤ `grace_minutes` | `Paid (Grace)`, GREEN, **0 min docked** (line 708) | `Unpaid (without Grace)`, GREEN, **`late_minutes` docked** (line 718, then line 266) |
| Late > `grace_minutes` | `Unpaid (with Grace)`, **`late_after_grace` docked** (line 713, then line 265) | `Unpaid (without Grace)`, **`late_minutes` docked** — an extra `grace_minutes` per incident |

Concretely: a grace-list employee with a 10-minute grace window arrives 9 minutes
late and files a form. Policy says they lose nothing. With the form invisible
they lose 9 minutes.

**And the row is GREEN.** `computeDerivedFields` (line 303) sets
`payroll_ready = 'YES'` for every GREEN row, so it never reaches Action Required.
There is no operator step at which anyone would look at it. Unlike the absence
case — which at least produces an alarming RED row somebody might question — this
one is invisible from both ends.

### 4. The compliance record says they never file

Line 742: `doc = 'Attendance Form'` is written only when `hasTardForm`. For a
**non-grace** employee the pay outcome is identical with or without a form (both
branches at 724-738 use `cfg.non_grace_auto_impact`), so no money moves. What
changes is the record.

`v_attendance_daily` derives `gaf_filed` from
`TRIM(documentation) IN ('Form Submitted', 'Attendance Form')`. Blank
documentation means the day is bucketed **"Late – Unreported"**, which drives the
Late-Reported/Late-Unreported KPIs and the Reporting Compliance donut on the
Attendance dashboard.

An employee who reports every single lateness reads, on the dashboard, as an
employee who never reports any. That dashboard is what a disciplinary
conversation is built on.

### 5. A Time-for-Time hold is lost

`adjustments` (line 518) and `permissions` (line 521) both feed the TFT test at
line 684. TFT on file forces YELLOW and blocks auto-resolution (lines 696-699,
756-760) precisely so an operator decides. An unseen TFT row lets the day
auto-resolve to Unpaid and pass through as ready.

### What is *not* affected

The non-scheduled-day gate (lines 448-475) runs **before** any form lookup and
keys on punches, never on forms. The weekend rule from 2026-08-25/26/27 is
untouched by this bug and would be untouched by a fix. Worth stating explicitly,
since "forms and days off" is the area where this project has been burned three
times.

### Fixing the engine does not clean up after itself

`upsertPayrollEntries` never deletes. Every row already written for an
already-processed period keeps its RED status and its 420 minutes until that
period is re-run — and `singleEmpMode` re-runs leave stale rows behind for
everyone else (00ef, candidate 2). Whatever route is chosen, **the historical
rows are a separate decision from the forward fix**, and the forward fix must
land before the next payroll run or it adds another period's worth.

---

## Recommendation

**Do the code fallback first, then correct the roster for pattern 1, then change
the form.** Three different problems, three different fixes; only the first is
urgent.

### 1. Code: make the email a first test, not the only test — do this now

Prompt is written and ready:
`docs/superpowers/prompts/2026-09-08-followups/B-email-fallback.md`.

It is the only route that recovers forms **already filed**. The 113 existing
forms cannot be re-filed; the addresses on them are frozen in the board history.
It is also the only route that works for pattern 5, where no domain rule could
ever help.

The design keeps the authority the current early-return exists to protect: an
email that belongs to a *different* roster employee still ends the test with no
match, because that row genuinely belongs to that other person. Only an email
that resolves to **nobody** falls through to the name. That distinction is the
whole safety of the change, and it is why the fallback needs the full roster
rather than the one employee `rowMatchesEmp` currently sees.

It is a change to `classificationEngine.ts`, which CLAUDE.md marks untouchable.
It should not be sent to UI Bakery until Saul says so.

**Deliberately not in that prompt:** writing a marker into `auto_notes` when a
row matched by fallback. It is a good idea — a fallback that succeeds silently is
only marginally better than one that fails silently — but it changes text that
tests pin and widens a payroll-engine change that should stay as small as
possible. Worth a separate prompt afterwards.

### 2. Data: three employees may simply be at the wrong company on the roster

Juan Molina (34 forms), Arelis Acosta (7), Reggina Sandoval (3) — 44 of the 113,
each consistently at one alternate domain. Check the Panama Employee Directory.
If `employees.teramind_email` is stale, correcting it fixes their forms *and*
their Teramind punch matching, which the code fallback cannot touch. Doing the
code fix and stopping there would hide a roster error behind a name match.

### 3. Process: stop new mismatches at the form

Patterns 2, 3 and 5 — 19 forms and counting — are people typing an email address
from memory into a free-text field. A dropdown, a pre-filled address, or
validating the address against the roster at submission time ends the whole class
of problem. This is the only fix that is genuinely preventive; it is also the
slowest and it does nothing for the backlog, which is why it goes third.

### 4. Surface it, whatever else happens

00ef already proposed this for the Reports tab: a visible **"form filed under an
unrecognised email"** flag. It costs nothing in the payroll engine, it needs no
approval to touch protected files, and it means the next occurrence is noticed in
days rather than found by accident four months later.

---

## Open questions for Saul

1. Are Juan Molina, Arelis Acosta and Reggina Sandoval actually at the domains
   their forms use? (Determines whether route 2 replaces route 1 for those 44.)
2. Do the mismatched rows carry names that resolve? (Query above. If a name does
   not resolve, that form needs a `name_aliases` entry regardless of route.)
3. Should already-processed periods be re-run after the fix, or corrected by
   hand? Re-running writes new rows without deleting old ones and has its own
   hazards.
