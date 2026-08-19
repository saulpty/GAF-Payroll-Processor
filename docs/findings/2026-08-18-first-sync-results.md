# First full Monday sync — results and what they mean, 2026-08-18

Owner-supplied ground truth: **44 active employees on the Panama directory,
plus 1 onboarded but not yet on it = 45 headcount.** Everyone else on the
boards is a past employee, some with historical payroll data. Timothy Moore is
a manager whose data is deliberately not tracked.

## Counts

| Board | Items | Matched | Unmatched | Last error |
|---|---|---|---|---|
| Employee Directory | 64 | 52 | 12 | none |
| Permissions & Requests | 297 | 295 | 2 | none |
| Attendance Forms | 1196 | 1184 | 12 | none |
| Employee Onboarding (Contracts) | 45 | 35 | 10 | none |

1602 rows mirrored. Attendance exceeds the 500-item page size, so pagination
is exercised for real. Re-running a board gives identical counts.

## The transient "Unknown error"

The owner saw `Can't execute upsertEmployee action: Unknown error`, and the
same for `upsertMondayAttendanceForms` and `upsertMondayContracts`, during a
period when browser tabs were freezing.

**Diagnosis: infrastructure, not code.** Three *different* actions failed at
the same moment, which is the signature `docs/CHANGE-LOOP.md` describes for
connection exhaustion rather than a defect. Confirmed by retry: contracts
re-synced cleanly afterwards (20:30:56Z) and `monday_sync_log.last_error` is
NULL on all four boards. Nothing was corrupted — the upserts are idempotent
and keyed on `monday_item_id`, so a failed run leaves prior rows intact.

If it recurs: close extra app tabs and retry before suspecting the code.

## The 10 unmatched contracts are NOT past employees

This contradicted the expectation and is the most useful thing the sync found.
Eight of the ten are **current, active staff** whose Onboarding rows carry
full legal names, while `employees.display_name` holds the short form:

| Onboarding board | Roster |
|---|---|
| Luis Felipe Abad Lemos | Luis Abad |
| Navvad Afua Owusu Biamah | Navvad Owusu |
| Tanya Thatiana Bedoya Ledezma | Tanya Bedoya |
| Arelis Yaneth Acosta Jiron | Arelis Acosta |
| Monique Alexandra Luque Valdonedo | Monique Luque |
| Eduardo Antonio Herrera Reyes | Eduardo Herrera |
| Jose Eduardo De Hermoso Mendoza | Jose De Hermoso |
| Eddy Miguel Cedeño Chavarría | Eddy Cedeño |

The remaining two are correct as unmatched: **Timothy Moore** (manager, not
tracked) and **Johann Morante** (almost certainly the "+1" who is onboarded
but not yet on the directory).

**Why it happens:** the Onboarding board has no employee-email column, so
`buildResolver` falls back to alias → normalized name. `normalizeName` strips
accents and case but cannot reduce "Eddy Miguel Cedeño Chavarría" to
"Eddy Cedeño". Eight `name_aliases` rows fix all eight; Task 9's inline
"Add alias" control is the intended place to add them.

This matters beyond tidiness: contract end dates and milestone tracking
(roadmap sub-project D) read this board. Unmatched rows would silently exclude
eight active employees from contract-expiry alerts.

## Open question — active count

The owner counts 44 active on the directory; `employees.active = true` is 43
after the sync. One-row discrepancy, not yet explained. Candidates: the "+1"
not on the directory, someone marked Active on Monday but inactive here, or a
directory row that did not match. Worth resolving before the PTO seed, since
accrual runs over active employees.

## Mirror fields still stale on two boards

The mirror/`display_value` fix (`57992ba`) landed after the directory and
attendance syncs ran. Their timestamps predate it, so `manager_email`, `role`
and `state` are still empty on those two tables. Re-run both; requests and
contracts already carry correct mirror values.

---

# Follow-up, 2026-08-19

## The active-count gap was Timothy Moore

Measured from the directory board itself (API playground, board 8592460836):
**64 rows, exactly 44 with Status = Active** — matching the owner's count. Of
the five people the sync offered to create, only one is Active:

| Person | Status on the directory board |
|---|---|
| Timothy Moore | **Active** |
| Juan Moreno | Resigned |
| Johann Morante | Resigned |
| Anagabriela Perez | Resigned |
| Yulisse Palacio | Offboarded |

So the 44-vs-43 gap was Timothy Moore: active on the board, absent from
`employees`. Added 2026-08-19 ("1 created"), bringing the app to 54 employees
and 44 active. The owner had said Tim's data was not tracked; he has since
confirmed Tim and Johann both work there and should be added.

## Johann Morante is a rehire, and his directory row still says Resigned

The owner described Johann as a rehire with both an active and a resigned
entry. On the *directory* board he has only one row and it reads **Resigned** —
that is his pre-rehire record. His new engagement appears on the *Onboarding*
board (the "Pre arrival" group, starting Aug 3), which is exactly the "onboarded
but not yet on the directory" case.

Left out deliberately, by owner decision. Creating him now would be
self-defeating: the next Directory sync reads Resigned and flips him inactive,
so he would flicker between states every sync. He should be added once his
directory row exists or is set to Active, keeping Monday as the single source
of truth.

## Duplicate board rows -- FIXED 2026-08-19 (`a170767`)

`syncDirectory.ts` loops board items and writes `active`, `role` and `manager`
per item. Two rows resolving to the same employee therefore race, and the last
one processed wins. For a rehire with an Active row and a Resigned row, whether
the employee ends up active depends on board ordering.

**Not firing today:** the directory board currently has no duplicate email and
no duplicate name (verified 2026-08-19 across all 64 rows). But the owner says
rehires do produce two entries, so this will bite eventually.

Fix when it matters: group board rows by resolved `employee_id` before writing,
and when a person has more than one row prefer the Active one — or more simply,
prefer the row with the latest start date. Do not simply take the last row seen.

### How it was fixed

It stopped being latent the same day: Johann Morante gained a second row
(`12843769792`, Current Employees, **blank** status) alongside his old one
(`10605676067`, Past employees, Resigned). Same email, different case.

The owner settled the rule: *"I don't consider an employee active until he is on
that Panama Employee Directory board, in the Current Employees group."*

So `active` is now group membership, read from `monday_group_directory_current`
in config (migration `1781804000`, value `topics`). The Status column is no
longer consulted for it — and could not be, since Johann's new row has no
Status set. Measured across all 65 rows: the current group holds 44 Active plus
that one blank; the past group holds 8 Resigned and 12 Offboarded. Group and
Status agree everywhere except that row.

Duplicate rows are collapsed before writing: group by resolved `employee_id`,
prefer the current-group row, tie-break on the highest item id. The sync card
reports how many were collapsed rather than doing it silently.

Applying it changed nothing — "0 updated" — which was the expected result and
the reason it was safe: moving `active` from Status to group reclassified
nobody who was already in the app.

**Still worth knowing:** the de-duplication path has not run against a real
duplicate, because Johann is deliberately not in `employees` yet. When he is
added, the first Directory sync should report "1 duplicate row collapsed" and
leave him active.

**Also unfixed:** the add-missing-employees dialog lists Johann *twice*, once
per board row. Ticking both would create two employees sharing one email. Low
risk while he is skipped, but that dialog should de-duplicate its candidates by
email before offering them.
