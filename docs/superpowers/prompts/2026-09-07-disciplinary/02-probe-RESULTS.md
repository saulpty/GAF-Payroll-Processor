# Probe results — 2026-09-07

Run against the live databases through the Hub's AI panel. Read-only; nothing
was created, modified or deleted. The prompt is `02-probe.md`, unchanged.

**Headline: the dataset is more than twice what the design assumed.**

| | design assumed | actual |
|---|---|---|
| actions | ~7 | **16** |
| employees | ~5 | **10** |
| managers | 2 | **4** |
| earliest / latest `document_date` | 06-04 → 06-30 | **2026-06-04 → 2026-08-19** |
| rows with no `revaluation_date` | 0 | **0** ✓ |
| rows already closed | 0 | **cannot test — column absent** ✓ expected |

The seed migrations in the exported form app were a snapshot. Managers have kept
filing since; ten of the sixteen actions are new to this design.

---

## Query 1 — the datasource and the table

**The datasource name is `SAUL Disciplinary Action Forms DB`** — the string in
the connection screenshot, not the `SAUL GA Offer Letter DB` the form app's own
actions use. That is what every new action must name.

All 25 expected columns are present with the expected types, including
`evidence_types` as `ARRAY` and `submitted_at` as `timestamptz NOT NULL`.

**`closed_at`, `closed_by` and `closure_note` do not exist yet.** Expected —
this probe deliberately ran before `01-form-app-migration.md`.

## Query 3 — every employee

| employee | role | branch | actions | latest | levels reached |
|---|---|---|---|---|---|
| Timothy Moore | Operations Manager | GAF | **4** | 2026-07-09 | Verbal, First Written, **Second Written** |
| Juan Molina | Intake 1 | Vitasya | 3 | 2026-06-23 | Verbal, First Written |
| Eduardo Herrera | EVV Specialist | GA West | 2 | **2026-08-19** | Verbal |
| Aleka Papatsoris | EVV Specialist | IN | 1 | 2026-06-24 | Verbal |
| Carlos Aloma | Intake 1 | GA | 1 | 2026-07-06 | Verbal |
| Jeanine Puyol | Intake 1 | PA | 1 | 2026-07-14 | Verbal |
| Jennette Torrano | Intake 1 | GA | 1 | 2026-08-14 | First Written |
| Navvad Owusu | EVV Specialist | GA West | 1 | 2026-06-04 | Verbal |
| Osvaldo Medina | EVV Specialist | PA | 1 | 2026-06-24 | First Written |
| Reggina Sandoval | Audit Specialist | Vitasya | 1 | 2026-08-11 | Verbal |

**Timothy Moore replaces Juan Molina as the live example.** Four actions and the
only Second Written Warning in the data — he exercises the escalation ladder
three rungs deep, which no other row does.

### Managers

Arelis Acosta, Marcela Gordon, **Leah Kessler**, **Saul Fallenbaum**. Two more
than the design knew about.

**`Arelis Acosta` appears with two different email casings** —
`arelis.a@vitasyahc.com` and `Arelis.A@vitasyahc.com`. Harmless here: the
manager filter matches on `manager_name`, which is identical in both, and the
email is only ever displayed. Worth knowing before someone "fixes" it.

## Query 4 — the values behind the chips

| warning_level | count |
|---|---|
| Verbal Warning | 11 |
| First Written Warning | 4 |
| Second Written Warning | 1 |
| Final Written Warning | **0** |

`final_outcome` is **empty on all 16 rows** — no Suspension, no Termination.

`scenario`: Calls / Lead Follow-up 8, Operational Instructions 5,
Attendance / Tardiness 2, Inappropriate Conduct 1. *Misuse of Systems / Tools*
has never been used.

`evidence_types` uses all six expected values.

**Every value in the data is on the expected list.** No unrecognised string
anywhere, so `levelRank`'s `-1` branch has no live instance — it stays in,
proved by unit test, because nothing in the schema prevents one.

## Query 5 — the same-day tie, confirmed

| id | ref | document_date | submitted_at |
|---|---|---|---|
| 8 | GAF-DA-2026-9827 | 2026-06-23 | 2026-06-23 00:00:00+00 |
| 10 | GAF-DA-2026-3947 | 2026-06-16 | 2026-06-16 00:00:00+00 |
| 9 | GAF-DA-2026-2645 | 2026-06-16 | 2026-06-16 00:00:00+00 |

**`submitted_at` is identical on the tied pair**, to the second. It cannot break
the tie, and neither can `document_date`. **`id DESC` is the only thing that
orders these two deterministically** — which is exactly what the design
specified, now confirmed against the real rows rather than assumed.

Real ids are 8, 9, 10; the unit-test fixtures have been corrected to match.

## Query 6 — name resolution: all ten resolve

**Every one of the ten names matches an `employees.display_name` exactly**, and
every one also has at least one `name_aliases` entry. Some of those aliases are
a good reminder of why the resolver exists: *ally papatsoris*, *ozzy medina*,
*menky torrano*, *Gigi Sandoval*, *Tim Moore*.

**So the "not on roster" chip has zero live instances.** It stays in — a new
name typed slightly differently in the other app would produce one immediately —
but it is proved by unit test, not on screen.

### The one thing this changes in the design

| employee | roster `role` | form `employee_role` |
|---|---|---|
| Juan Molina | **NULL** | Intake 1 |
| Osvaldo Medina | **NULL** | EVV Specialist |

The design said the page prefers the roster's `role` and falls back to the
form's only when the **name** does not resolve. Both of these names *do*
resolve, but their roster role is null — so under the design as written, two
rows would show a blank role while the disciplinary record plainly knows it.

**Correction: fall back to the form's `employee_role` / `employee_branch`
whenever the roster value is null or empty, independently of whether the name
resolved.** Prompt `05-table-and-row.md` has been amended.

## Query 7 — two inactive employees

**`Juan Molina` and `Osvaldo Medina` are both `active = false`** (with no
`end_date` recorded). The other eight are active.

This is precisely the case Saul decided for: *everyone with a record appears,
active or not*. Two rows will render muted with an `inactive` chip. Had the page
filtered on `active = true`, four of the sixteen actions — including a First
Written Warning — would have silently disappeared.

---

## What this changes about the design

1. **Counts.** Acceptance moves from "5 rows" to **10 rows / 16 actions**.
2. **The live example changes** from Juan Molina to **Timothy Moore** — 4
   actions, Second Written Warning, the deepest escalation in the data.
3. **Role fallback** must trigger on a null roster role, not only on an
   unresolved name. Two employees hit this today.
4. **Two inactive employees exist**, so the muted row is a live case rather than
   a unit-test-only one.
5. **`submitted_at` cannot break the same-day tie** — confirmed, not assumed.
6. Still zero live instances, kept and proved by unit test only: a closed case,
   a Suspension/Termination outcome, a Final Written Warning, a null
   `revaluation_date`, and an unresolvable name.
7. Open question for the follow-up probe: the latest action is **2026-08-19**,
   so it is no longer safe to assume every re-evaluation date has passed. See
   `02b-probe-followup.md`.
