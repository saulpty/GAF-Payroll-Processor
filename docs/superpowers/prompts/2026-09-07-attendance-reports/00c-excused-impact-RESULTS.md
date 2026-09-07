# Excused mis-grouping — impact, 2026-09-07

Output of `00c-excused-impact.md`, run through the UIB AI panel against
`GAF Planilla DB`. Read-only apart from deleting the stray `docs/` folder,
which is confirmed gone.

## How the dashboard reads today

| Status in `v_attendance_daily` | Rows |
|---|---|
| On Time | 2,394 |
| Late - Reported | 656 |
| Late - Unreported | 627 |
| Excused (PTO/FH/Perm) | 343 |
| Permission | 144 |

## What is inside those 343 "Excused" rows

| Component | Count | Belongs there? |
|---|---|---|
| PTO | 160 | yes |
| Ausencia Justificada. | 90 | yes |
| Feriado (holiday) | 64 | yes |
| **Ausencia Injustificada** | **29** | **no — this is a no-show** |
| Compensatory Day | 0 | — |
| Birthday Day Off | 0 | — |

**29 of 343 rows (8.5%) move out of Excused.** Nothing else changes: On Time,
both Late buckets and Permission are untouched.

## All event types, for context

| event_type_1 | Rows | No punches | Range |
|---|---|---|---|
| *(empty)* | 2,646 | 1 | 2026-03-11 → 2026-08-24 |
| Tardanza | 1,625 | 0 | 2026-03-11 → 2026-08-24 |
| PTO | 175 | 175 | 2026-03-11 → 2026-08-24 |
| Permiso Remunerado | 165 | 145 | 2026-03-11 → 2026-08-24 |
| Salida Temprano | 157 | 0 | 2026-03-11 → 2026-08-24 |
| Ausencia Justificada. | 120 | 113 | 2026-03-11 → 2026-08-24 |
| Feriado | 82 | 82 | 2026-04-03 → 2026-05-01 |
| **Ausencia Injustificada** | **65** | **64** | 2026-03-30 → 2026-08-21 |
| Permiso No remunerado | 44 | 40 | 2026-03-20 → 2026-07-27 |

65 rows in `payroll_entries`; 29 of them survive into the dashboard (the rest
belong to inactive or payroll-excluded employees, or fall on non-work days).

## Who they belong to — 14 active employees

| Employee | Manager | Days | Earliest | Latest |
|---|---|---|---|---|
| Cemiriamiz Iglesias | Marcela Gordon | 10 | 2026-07-27 | 2026-08-07 |
| Euclides Gonzalez | Marcela Gordon | 9 | 2026-07-27 | 2026-08-07 |
| Michael Antonio Jones Roye | Marcela Gordon | 6 | 2026-07-13 | 2026-07-20 |
| Edwin Broce | Marcela Gordon | 6 | 2026-07-13 | 2026-07-20 |
| Maria Alejandra De Urriola | Cheyenne Pelis | 5 | 2026-07-13 | 2026-07-17 |
| Favian Fortune | Marcela Gordon | 4 | 2026-04-17 | 2026-08-19 |
| Monique Luque | Chaya Lichy | 4 | 2026-07-10 | 2026-07-24 |
| Alanis Chena | Susan Arriola | 3 | 2026-04-24 | 2026-04-28 |
| Johann Morante | Marcela Gordon | 1 | 2026-08-21 | 2026-08-21 |
| Jennette Torrano | Marcela Gordon | 1 | 2026-08-11 | 2026-08-11 |
| Carlos Aloma | Marcela Gordon | 1 | 2026-04-10 | 2026-04-10 |

By period: Q2-Jul-2026 **23**, Q1-Aug-2026 **19** — 42 of 65 (65%) in those two
periods alone. Q1-Apr 7, Q1-May 6, Q1-Jul 3, Q2-Aug 3, Q2-Apr 2, Q2-May 1,
Q2-Jun 1.

## The finding that is not a display bug

**13 of 66 `Ausencia Injustificada` rows have an attendance form behind them.**

The engine reached Step 5 ("No data + no form") and stamped the day unjustified
while a form for that person on that date sits in `monday_attendance_forms`.
Renaming the status on the dashboard would not fix these — they are misclassified
at the source, not merely mislabelled at the surface.

Two candidate causes, neither yet confirmed:

1. The form arrived in the mirror **after** the period was processed. The engine
   reads Monday live during a run, so a form synced later cannot retroactively
   change a stored row — and `upsertPayrollEntries` never deletes, so the old
   row survives with its discount.
2. The form did not resolve to the employee at run time (name/email matching),
   so the engine genuinely could not see it.

The multi-week stretches at the top of the table (Iglesias 10 days, Gonzalez 9,
both 07-27 → 08-07) look like whole absences rather than scattered no-shows —
worth confirming those are real before any of this reaches a manager's screen.

## What this settles

Saul's decision: attendance measures **presence**. Legitimate away days (PTO,
holiday, birthday, comp day, justified absence, permission) stay visible but
must not affect the score; an unexplained absence is its own status and counts
against. The 29 rows are exactly the rows that decision is about.
