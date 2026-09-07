# Follow-up probe results — 2026-09-07

Read-only. Prompt is `02b-probe-followup.md`, unchanged.

## Query A — every single case is overdue

| metric | value |
|---|---|
| total actions | 16 |
| **overdue** (`revaluation_date < 2026-09-07`) | **16** |
| still ahead (`>= today`) | **0** |
| **due within 30 days — the nav badge number** | **16** |
| earliest `revaluation_date` | 2026-06-19 |
| latest `revaluation_date` | **2026-09-02** |

The assumption held after all. The latest re-evaluation fell five days ago, so
**the design's acceptance criterion is intact: the nav badge reads `16` and
equals the open action count.** Worth having checked rather than assumed — an
action filed on 2026-08-19 could easily have carried a re-evaluation into
October, and the criterion would then have been wrong on screen.

It also means **the page opens entirely red.** Ten rows, every one carrying a
`review overdue` chip. That is a true statement about the data — nobody has
recorded a closure, because until this feature there was nowhere to record one.
It is the opposite of the Contracts page, where most rows are deliberately grey.
**Do not "fix" it by softening the overdue rule.**

## Query B — all 16 actions, in page order

Every row's `state_today` is `overdue`. Ids run 6–22 with gaps, confirming rows
were deleted by the form app's cleanup migrations.

| id | employee | document | re-eval | level |
|---|---|---|---|---|
| 7 | Aleka Papatsoris | 2026-06-24 | 2026-07-08 | Verbal |
| 16 | Carlos Aloma | 2026-07-06 | 2026-07-17 | Verbal |
| 22 | Eduardo Herrera | 2026-08-19 | 2026-09-02 | Verbal |
| 15 | Eduardo Herrera | 2026-06-30 | 2026-07-30 | Verbal |
| 18 | Jeanine Puyol | 2026-07-14 | 2026-07-20 | Verbal |
| 21 | Jennette Torrano | 2026-08-14 | 2026-08-28 | First Written |
| 8 | Juan Molina | 2026-06-23 | 2026-07-07 | First Written |
| 10 | Juan Molina | 2026-06-16 | 2026-06-23 | Verbal |
| 9 | Juan Molina | 2026-06-16 | 2026-06-19 | Verbal |
| 11 | Navvad Owusu | 2026-06-04 | 2026-07-10 | Verbal |
| 6 | Osvaldo Medina | 2026-06-24 | 2026-07-08 | First Written |
| 20 | Reggina Sandoval | 2026-08-11 | 2026-08-25 | Verbal |
| 17, 14, 13, 12 | Timothy Moore | see below | | |

## Query C — Timothy Moore, and why he is the right demonstration

Newest first, exactly as the table will order him:

| id | ref | document | re-eval | level | scenario |
|---|---|---|---|---|---|
| 17 | GAF-DA-2026-5106 | 2026-07-09 | 2026-07-16 | **Verbal Warning** | Operational Instructions |
| 14 | GAF-DA-2026-9269 | 2026-07-01 | 2026-07-30 | **Second Written Warning** | Calls / Lead Follow-up |
| 13 | GAF-DA-2026-7033 | 2026-07-01 | 2026-07-30 | First Written Warning | Calls / Lead Follow-up |
| 12 | GAF-DA-2026-5763 | 2026-07-01 | 2026-07-29 | Verbal Warning | Calls / Lead Follow-up |

Two things here that no other row in the data exercises:

**1. Three actions share one `document_date`.** Verbal, First Written and Second
Written were all filed on 2026-07-01 — an escalation chain entered in one
sitting. Only `id` separates them. Juan Molina's tie was two rows; this is
three, and it makes the `id DESC` rule load-bearing twice over. In the case
file, which reverses to oldest-first, they read **12 → 13 → 14**, i.e. Verbal →
First Written → Second Written, exactly the order the escalation happened.

**2. His newest action is a *lower* level than his highest.** The 07-09 action
is a Verbal Warning, while his ladder reaches Second Written from 07-01. So:

- **Highest level** shows `Second Written Warning`, ladder filled 3 of 4.
- **Latest** shows `07-09-2026 · Operational Instructions` — a Verbal.

This is the case that proves the design's choice of showing the **highest** level
rather than the latest one. A page keyed on "most recent warning" would show
Timothy Moore as a Verbal Warning and hide that he is two rungs further up.

## Query D — the two inactive employees

| display_name | active | roster role | roster manager |
|---|---|---|---|
| Juan Molina | **false** | **NULL** | Marcela Gordon |
| Osvaldo Medina | **false** | **NULL** | Jessica Crivelli |

Both confirmed inactive with a null roster role, as the first probe found.

**A new detail: Osvaldo's roster manager is Jessica Crivelli, but his
disciplinary action was filed by Arelis Acosta.** The two are different people
and both are correct — one is his manager now, the other is whoever wrote the
warning at the time.

The page's Manager column shows `manager_name` from the disciplinary record,
i.e. **who filed the action**, which is the right value for this page and for
the manager filter. But the column needs a tooltip saying so, or it will be read
as "current manager" and quietly disagree with every other page in the app.
Prompt `05-table-and-row.md` has been amended.

---

## What this changes about the design

1. **The badge number is `16`**, and every one of the ten rows is overdue. The
   acceptance criterion survives unchanged.
2. **Timothy Moore is the demonstration row** — three same-day actions, a
   three-rung ladder, and a latest action that is lower than his highest.
3. **The Manager column needs a tooltip**: it is the manager who filed the
   action, not the employee's current manager. Osvaldo Medina is the live case
   where the two differ.
4. Nothing else moved. The rules in `disciplinary.ts` are unchanged.
