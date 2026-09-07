<!-- Date: 2026-09-07 | Database: GAF Planilla DB | Output of: 00-probe.md -->

# Attendance Reports Tab — Live Data Probe Report
**Date:** 2026-09-07 | **Database:** GAF Planilla DB | **Analyst:** uib agent

---

## Q1 — `documentation` strings & `filed_gaf` correctness

**Goal:** Confirm whether a new `'Attendance Form'` string replaced `'Form Submitted'`, which would break the `filed_gaf` flag.

### Distribution of `documentation` values in `payroll_entries`

| Value | Row count |
|---|---|
| *(empty)* | 3,724 |
| `Form Submitted` | 1,152 |
| `Not Required` | 82 |
| `Doctor Note – Pending` | 60 |
| `Doctor Note – Logged` | 54 |
| `Form Pending` | 7 |
| **`Attendance Form`** | **0** |

**Per-period check (Q2-Mar-2026 → Q2-Aug-2026):** Every period shows `old_string` (`Form Submitted`) > 0, `new_string` (`Attendance Form`) = 0. No changeover ever occurred.

### Verdict
`'Attendance Form'` was **never written to the database.** The `filed_gaf` flag (`documentation = 'Form Submitted'`) is **correct and not broken.** The original assumption that the string changed on 2026-08-27 was wrong — `filed_gaf` sees all filed forms accurately.

---

## Q2 — `submitted_at` timezone & time format

**Goal:** Determine whether `submitted_at` is UTC or Eastern, whether it carries a time, and whether `form_date` can be trusted as the calendar day.

### Comparison: board display vs. DB columns

| Source | Value for one example form |
|---|---|
| Monday.com board display | "Sep 2, 9:03 AM" |
| `submitted_at` in DB | `"2026-09-02 09:03"` |
| Raw JSON `date0d5ep965 → time` | `"13:03:23"` (UTC) |
| `form_date` in DB | `2026-09-02` |

### Answers

1. **Does `submitted_at` carry a time?** Yes — format is `HH:MM` (no seconds).
2. **Is it UTC or Eastern?** **Eastern wall clock.** The board displays "9:03 AM" and the DB stores `09:03`. UTC lives only in the raw JSON column (`13:03:23`, 4 hours ahead during EDT).
3. **Is `form_date` the correct calendar day?** Yes — it matches the board's date label exactly, no UTC rollover risk.

### Implication for lateness comparison
`submitted_at` (`HH:MM` Eastern) can be compared directly to `scheduled_start` (`"9:00 AM"` Eastern) after parsing both into minutes-since-midnight. No timezone conversion needed.

---

## Q3 — Punchless days

**Goal:** Do rows with no `entry_time` already exist in `payroll_entries`, or does the Reports tab need to synthesize them?

### Counts

| Category | Rows |
|---|---|
| Total `payroll_entries` rows | 5,079 |
| Rows with no `entry_time` | 620 |
| No `entry_time` AND no `event_type` | 1 |
| No `entry_time` AND no `scheduled_start` | 1 |

### `scheduled_start` format
`"9:00 AM"` — `H:MM AM/PM`, **no leading zero** on the hour (9, not 09).

### Verdict
**Punchless rows already exist as real rows.** The payroll engine creates them (620 of 5,079, ~12%). The Reports tab does NOT need to generate synthetic rows — just query `payroll_entries` and treat `entry_time IS NULL` as "did not punch in." Only 1 row has no `scheduled_start` at all (safe to ignore or display as "—").

---

## Q4 — Data reach & form types

**Goal:** How far does processed payroll data reach? How far do synced forms reach? What are the form types and reasons?

### Payroll vs. forms timeline

| Milestone | Date |
|---|---|
| Latest processed period end | 2026-08-24 (Q2-Aug-2026, processed 2026-08-25) |
| Latest form synced | 2026-09-02 (last sync 2026-09-02 14:43 UTC) |
| Gap (forms with no period yet) | **2026-08-25 → 2026-09-02 (~8 days)** |

Forms submitted for Aug 25 – Sep 2 exist in `monday_attendance_forms` but have no corresponding `payroll_entries` rows yet. The Reports tab should display these days as "not yet processed."

### Form counts

| Metric | Count |
|---|---|
| Total forms | 1,310 |
| Unmatched to an employee | 4 |
| Deleted on Monday | 0 |

### Form types & reasons

| Form type | Count |
|---|---|
| Tardiness | 1,164 |
| Absence | 146 |

| Reason | Count |
|---|---|
| *(empty — Tardiness has no reason field)* | 1,164 |
| Sick | 125 |
| Accident / Emergency | 21 |

---

## Q5 — What "covers" a day (requests & holidays)

**Goal:** Identify which request types legitimately excuse a day, how the date window works, and what holidays exist.

### Request types

| Type | Count | Excuses absence? |
|---|---|---|
| Work From Home | 99 | No (employee present, working remotely) |
| Time Off / Permission | 88 | **Yes** |
| PTO / Vacation | 61 | **Yes** |
| Floating Holiday | 37 | **Yes** |
| Birthday Day Off | 13 | **Yes** |
| Compensatory Day | 9 | **Yes** |
| Work on a Holiday | 7 | No (employee working extra) |

### Permission sub-types (`permission_type` column)

| Value | Count |
|---|---|
| *(empty)* | 227 |
| Time for Time | 72 |
| Time for Time (Days) | 9 |
| Unpaid | 6 |

All sub-types are relevant to "Time Off / Permission" rows; the sub-type does not change whether the day is excused.

### Date window rule
From the sample data (e.g., Reggina Sandoval PTO Dec 18–20, `return_date` Dec 21, `total_days` = 3):

**`start_date <= day < return_date` (return_date is exclusive — it's the first day back).**

`end_date` and `return_date` are always consecutive; `return_date` is the reliable boundary. `start_datetime` and `end_datetime` are **empty strings** for all rows — no partial-day time data is available through requests.

### Upcoming holidays (from DB, Aug 2026 onward)

| Date | Name |
|---|---|
| 2026-11-03 | Separation Day |
| 2026-11-05 | Colón Celebration |
| 2026-11-10 | Independence Cry |
| 2026-12-08 | Mother's Day |
| 2026-12-21 | Day of Remembrance |
| 2026-12-25 | Christmas Day |

---

## Q6 — Schedules & employee coverage

**Goal:** What schedules exist? Are there employees with no schedule, no manager, or no start date?

### Schedules

| Schedule | Start (standard) | End | Grace | Work days | Employees |
|---|---|---|---|---|---|
| Standard | 9:00 AM | 5:00 PM | 10 min | Mon–Fri | 39 |
| Weekend Mon–Tue OFF | 9:00 AM | 5:00 PM | 10 min | Wed–Sun | 2 |
| Monique Luque | 9:00 AM | 4:00 PM | 10 min | Mon–Fri | 1 |
| Weekend Tue–Wed OFF | 9:00 AM | 5:00 PM | 10 min | Mon, Thu–Sun | 1 |
| Favian Fortune | **10:00 AM** | 6:00 PM | 10 min | Mon–Fri | 1 |
| Weekend Thu–Fri OFF | 9:00 AM | 5:00 PM | 10 min | Mon–Wed, Sat–Sun | 1 |

DST/standard start times are **identical** for all schedules — no DST adjustment to `standard_start`.

### Employee coverage

| Stat | Count |
|---|---|
| Active employees | 45 |
| No schedule assigned | 0 |
| No start date | 0 |
| No manager | 0 |

**Zero fallback cases.** Every active employee has a schedule, a manager, and a start date. No defensive defaults are needed for the initial release.

### DST dates (for `submitted_at` / `scheduled_start` comparisons)

| Year | DST starts | DST ends |
|---|---|---|
| 2025 | Mar 9 | Nov 2 |
| 2026 | **Mar 8** | **Nov 1** |
| 2027 | Mar 14 | Nov 7 |

Since `submitted_at` is already Eastern wall clock, DST only matters if you ever need to convert UTC timestamps — which you don't for form comparison.

---

## Q7 — Join quality: forms ↔ payroll days

**Goal:** What fraction of late days have a matching form? Are there orphan forms? Are there duplicate forms per day?

### Late-day coverage (Aug 15, 2026 onward)

| Category | Count |
|---|---|
| Late days with a matching form | 50 |
| Late days with **no** form | 47 |
| Total | 97 |

~52% of late days (since Aug 15) have an attendance form. The 47 unmatched are real gaps — employees who arrived late but never submitted a form.

### Sample of Aug 24 data (last processed day)

| Employee | Entry | Late min | Documentation | Form? |
|---|---|---|---|---|
| Alanis Chena | 9:29 AM | 29 | Form Submitted | ✅ Tardiness |
| Charles Bush | 9:29 AM | 29 | *(empty)* | ❌ None |
| Domingo Cruz | 9:29 AM | 29 | Form Submitted | ✅ Tardiness |
| Favian Fortune | 10:03 AM | 3 | *(empty)* | ❌ None |
| Gabriel Chu | 9:04 AM | 4 | *(empty)* | ❌ None |
| Gisselle Ramos | 9:29 AM | 29 | *(empty)* | ❌ None |
| Jeanine Puyol | 9:29 AM | 29 | Form Submitted | ✅ Tardiness |
| Jennette Torrano | 9:02 AM | 2 | Form Submitted | ✅ Tardiness |
| Karhid Arevalo | 9:09 AM | 9 | Form Submitted | ✅ Tardiness |
| Navvad Owusu | 9:06 AM | 6 | Form Submitted | ✅ Tardiness |
| Reggina Sandoval | 9:29 AM | 29 | *(empty)* | ❌ None |
| Tanya Bedoya | 9:07 AM | 7 | Form Submitted | ✅ Tardiness |
| Winston Carrillo | 11:27 AM | 147 | Form Submitted | ✅ Tardiness |

**Note — Edwin Broce (Aug 22):** Form exists in `monday_attendance_forms` (`submitted_at 08:11`) but `documentation` is blank. This is a known engine join gap — `filed_gaf` will correctly show `true` in the Reports tab even though `documentation` wasn't stamped.

### "Orphan" forms (forms with no payroll row)

All 20 orphan rows are from **2026-09-01 and 2026-09-02** — the period Q1-Sep-2026 has not been processed yet. There are **no true orphans.** The Reports tab should show these as "form on file, period not yet processed."

One quirk: **Daniel Escruceria Riquelme** appears twice for 2026-09-02 (two Absence forms). That falls into the duplicate category below.

### Duplicate forms per day (15 cases)

| Pattern | Example | Interpretation |
|---|---|---|
| Tardiness + Tardiness (same minute) | emp 10, May 19: `09:06` vs `09:05` | Double-submit; pick earliest |
| Tardiness + Tardiness (later resubmit) | emp 55, Aug 26: `08:08` vs `09:28` | Resubmit after correction; pick earliest |
| Tardiness + Absence (same day) | emp 42, Aug 17: Tardiness `08:19`, Absence `13:26` | Arrived late, left sick; both are valid events |
| Absence + Absence | emp 31, Sep 2: `10:03` vs `00:35` | The `00:35` is likely a midnight UTC artifact; pick `10:03` |

**Recommended tiebreak:** For display, pick the form with the **earliest `submitted_at`** — this is the one the employee submitted first (most likely the intentional, pre-arrival form). For Tardiness+Absence combos, show both (different event types).

---

## Summary: What This Changes About the Design

| Topic | Original assumption | Confirmed reality | Design impact |
|---|---|---|---|
| `filed_gaf` correctness | Possibly broken (new string?) | ✅ Correct — `'Form Submitted'` is still the only value | Use `documentation = 'Form Submitted'` as-is |
| `submitted_at` timezone | Unknown | Eastern wall clock, `HH:MM` | Compare directly to `scheduled_start`; no conversion |
| Punchless days | May need to be synthesized | ✅ Already rows in `payroll_entries` | Just query; treat `entry_time IS NULL` as no punch |
| Away window | Unknown | `start_date <= day < return_date` (exclusive) | Use `<` not `<=` on return_date |
| Partial-day permissions | Hoped for | ❌ `start_datetime`/`end_datetime` always empty | No partial-day coverage logic possible |
| Duplicate forms | Not anticipated | 15 cases exist | Tiebreak: earliest `submitted_at`; show both if Tardiness+Absence |
| Late-day form gaps | Unknown scale | 47 of 97 late days (48%) have no form | Display as "Missing Form" status |
| Unprocessed days (Sep 1–2) | Would be orphans | Are real — period not yet run | Show as "Pending Processing" state |
| Employee coverage | Might have gaps | ✅ All 45 active employees have schedule + manager + start_date | No defensive defaults needed |
| Holidays in DB | Unknown | 6 holidays from Nov–Dec 2026 onward | Can mark holidays automatically from DB |

**The Reports tab is buildable on the current data with no schema changes required.** The only edge cases to handle in code are: duplicate forms (tiebreak), the "pending processing" state for Sep 1+ days, and the 47 genuinely missing forms displayed as a distinct status.

---

## Addendum — verified against the code, not taken on trust (Claude, 2026-09-07)

Three of the report's conclusions were checked against `classificationEngine.ts`
and the live view definition. Two hold. One is right in its conclusion but wrong
in its reasoning, and the difference changes the design.

### 1. Q1 holds, and the reason matters

`'Attendance Form'` really is absent from the database — but not because the
engine never writes it. `classificationEngine.ts:591,742` does write it. The
reason no row has it is that **the last processed period (Q2-Aug-2026) was
processed on 2026-08-25, two days before the 2026-08-27 rename.**

So `filed_gaf` is correct *today* and breaks on the **next payroll run**, when
every filed tardiness form starts landing as `'Attendance Form'` and
`filed_gaf` stops seeing it. Step 0 is therefore **prevention, not repair** —
and it must ship before the next run, not after.

### 2. Q3's conclusion is right; its reasoning is wrong, and the marker is different

The report says punchless rows exist and infers that a no-show is a row with
"no entry_time AND no event_type" — a category it measured at **1 row**, which
would suggest no-shows essentially never happen.

That is not how the engine records a no-show. `classificationEngine.ts:643-656`
(Step 5, "No data + no form") pushes a row with:

- `event_type_1 = 'Ausencia Injustificada'`
- `auto_notes = 'NO DATA + NO FORM (Suggested: Unpaid)'`
- `initial_status = 'RED'`, plus a full-day discount

**So an unexplained absence always carries an event type.** Detecting one by
looking for a blank `event_type_1` finds almost nothing (hence the count of 1).
The Reports tab must key on `event_type_1 = 'Ausencia Injustificada'` — or on
the `auto_notes` marker — never on "no event type".

### 3. A live display bug this exposes

`v_attendance_daily` puts `'Ausencia Injustificada'` in its `is_excused` list
(`1781900300_v_attendance_daily_excludes_deleted.sql`, alongside `PTO`,
`Feriado`, `Compensatory Day`, `Birthday Day Off`, `Ausencia Justificada.`).

The status expression tests `is_excused` first, so **an unjustified no-show is
displayed today as `Excused (PTO/FH/Perm)`** and is excluded from every
lateness bucket. Whatever the intent was for payroll, it is wrong for a manager
reading attendance: the one category that most needs a manager's attention is
currently rendered as the most benign.

The Reports tab must not inherit this grouping. Whether to also correct the
view is a separate decision for Saul — it changes numbers on the existing
Dashboard, so it is not folded into step 0.

### 4. Consequences for the plan

- Step 0 keeps its migration, reframed as pre-emptive: accept both
  `'Form Submitted'` and `'Attendance Form'` so the next run cannot silently
  zero the Reported figures.
- `attendanceReport.ts` gets `'Ausencia Injustificada'` as the unexplained
  marker, with a unit test asserting a blank-event-type rule would miss it.
- The `is_excused` mis-grouping is recorded in `docs/LESSONS.md` and raised
  with Saul as its own decision.
