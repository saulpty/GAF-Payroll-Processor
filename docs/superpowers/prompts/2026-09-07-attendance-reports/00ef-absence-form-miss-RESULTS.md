# Why Step 3 missed 7 Absence forms — 2026-09-07

Output of `00e-absence-form-miss.md` and `00f-verify-snapshot-dates.md`.
Read-only throughout; nothing created, modified or deleted.

**Two hypotheses tested. Both dead. The cause is still unknown — and one
unrelated finding is bigger than the thing we were chasing.**

## The unrelated finding, which matters most

**113 attendance forms across 24 employees carry an email that does not match
the person's `teramind_email`.**

`rowMatchesEmp` (`classificationEngine.ts:391-405`) short-circuits: when a form
has an email, the email is the *only* test — there is no fallback to the name or
to `name_aliases`. So every one of those 113 forms is invisible to a payroll
run, no matter how obviously it belongs to a known person.

The mirror's own resolver (`buildResolver`) *does* fall back to alias and name,
which is why these forms look correctly matched in `monday_attendance_forms`
and are simultaneously unseen by the engine. The two paths disagree by design.

| Employee | roster `teramind_email` | email on the form | Forms | Range |
|---|---|---|---|---|
| Juan Molina | juan.molina@vitasyahc.com | juan.molina@**passiontocarehc**.com | 34 | 2026-05-15 → 07-09 |
| Arelis Acosta | arelis.a@vitasyahc.com | arelis.a@**passiontocarehc**.com | 7 | 2026-01-15 → 02-03 |
| Gabriel Chu | gabo.c@vitasyahc.com | **gaboc**@vitasyahc.com | 4 | 2026-03-18 → 07-30 |
| Edwin Broce | edwin.b@passiontocarehc.com | **e.broce**@passiontocarehc.com | 3 | 2026-08-17 → 08-30 |
| Aleka Papatsoris | ally.p@passiontocarehc.com | ally.p@**passiontocare**.com | 3 | 2026-04-21 → 05-04 |
| Reggina Sandoval | gigi.s@vitasyahc.com | gigi.s@**avondalecaregrouppa**.com | 3 | 2026-01-16 → 02-12 |
| Arelis Acosta | arelis.a@vitasyahc.com | arelis.a@**vistasyahc**.com *(typo)* | 2 | 2026-04-27 → 09-02 |
| Natalia Esquivel | nati.e@passiontocarehc.com | **nati16esquivel@gmail.com** | 2 | 2026-03-06 → 03-20 |
| Navvad Owusu | navvad.o@passiontocarehc.com | navvad.o@**passiontocare**.com | 2 | 2026-01-20 → 02-06 |
| Elizabeth Mootoo | ely.m@vitasyahc.com | ely.m@**vitasya**.com | 2 | 2026-03-04 → 03-05 |
| Jose Navarro | jose.n@passiontocarehc.com | **jose_navarro80@yahoo.com** | 2 | 2026-01-30 → 03-11 |
| Alanis Chena | alanis.c@vitasyahc.com | alanis.c@**vitasya**.com | 2 | 2026-03-18 → 03-19 |
| Lilian Barría | lili.b@passiontocarehc.com | lili.b@**pasaiontocarehc**.com *(typo)* | 2 | 2026-06-17 → 08-06 |
| Gabriel Chu | gabo.c@vitasyahc.com | gabo.c@**vitasya**.com | 2 | 2026-06-25 → 07-08 |
| Monique Luque | monique.l@passiontocarehc.com | **monique.luque**@passiontocarehc.com | 2 | — |

The patterns are mundane and will keep recurring: wrong company domain, a
missing dot, `.com` for `hc.com`, a domain typo, a personal gmail/yahoo address.
Arelis Acosta's typo'd form is dated **2026-09-02** — five days ago. This is
live, not historical.

**This is a bigger exposure than the 13 rows that started the investigation**,
and it is not what those 13 rows were caused by.

## Hypothesis 1 — email mismatch. Dead.

For the six days in question, the snapshot emails matched the roster exactly:
`ozzy.m@avondalecaregrouppa.com` and `monique.l@passiontocarehc.com`. Only 2 of
Monique Luque's 18 forms carry a wrong address, and they are not these.

## Hypothesis 2 — ISO date format. Dead, and it was never alive.

The previous reply declared this "confirmed": snapshot dates as
`"2026-07-13T00:00:00.000Z"` compared against plain `YYYY-MM-DD`.

Measured directly: **every `date` value in every snapshot has
`LENGTH() = 10`.** No 24-character values exist anywhere.

It was the Postgres `DATE → text` trap already recorded in `docs/LESSONS.md`
— reading `form_date` from the mirror renders as an ISO timestamp, while the
snapshot's `date` is the plain string `ProcessPayroll.tsx:251` builds with
`.slice(0, 10)`. The conclusion was drawn from the wrong column.

It could not have been true in any case: if every date comparison failed, no
row would ever be stamped `Form Submitted`, and 1,152 rows are.

## What the snapshots do establish

- Snapshots exist for every period back to 2026-06, and are **not truncated** —
  1,032 rows for Q2-Jul-2026 (2026-07-27), rising to 1,266 for Q2-Aug-2026, in
  step with the board's growth to 1,310 today.
- **All six Medina/Luque dates are present** in the Q2-Jul-2026 snapshot and
  every snapshot after it.
- Their dates are 10 characters, their emails match, their type is `Absence`.

So the engine was handed the forms, with the right person, the right day and the
right type — and still reached Step 5. **Every mechanism proposed so far is
eliminated.**

Note: the snapshot stores `employeeName` as **"Ozzy Medina"** while the roster
says "Osvaldo Medina". Irrelevant to matching here (the email path wins and
matched), but worth remembering if a name-based theory is tried next.

## Untested candidates, for whoever picks this up

Not investigated, in rough order of promise:

1. **The rows may not be engine output at all.** If those days were loaded by
   the Excel import rather than produced by a run, no engine logic ever applied.
   `docs/LESSONS.md:289-298` already warns that the import and the Monday mirror
   describe the same events. Check whether `auto_notes` on all 7 really reads
   `NO DATA + NO FORM` — engine-generated text — or something else.
2. **Re-runs.** Q2-Jul-2026 has three snapshots on 2026-07-27. If a later run
   used single-employee mode, rows for excluded employees survive from an
   earlier one, and `upsertPayrollEntries` never deletes.
3. **Step 2 short-circuit.** Full-day permission is evaluated before Step 3; a
   permission covering the date would exit earlier — though it would produce a
   different event type, so this is weak.

## Data-quality oddities noticed in passing

- A period is named **`Q1-Aug-20260`** (trailing zero) in `run_snapshots`.
- A **`junio test` / `Q1-JUN-2026`** snapshot holds 0 rows.

## Where this stops

The engine is unchanged. Payroll is not to be touched without Saul's explicit
say-so, and this has moved from "build a Reports tab" into a payroll-correctness
investigation with 85.83 discounted hours attached. The remaining candidates are
cheap to test but the decision to keep going is Saul's.

**None of this blocks the Reports tab.** It reads stored rows and will surface
the contradiction — *"recorded as unexplained, form on file"* — rather than
silently correcting it. The 113 mismatched emails argue for one addition: a
visible "form filed under an unrecognised email" flag, since those forms are
invisible to payroll but perfectly visible to the mirror the Reports tab reads.
