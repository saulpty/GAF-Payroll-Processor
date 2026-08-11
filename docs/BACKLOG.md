# Project B backlog

Things found but deliberately not fixed yet. Each gets its own design → plan →
build cycle through the loop in `CHANGE-LOOP.md`.

Ordered by risk to payroll correctness, not by effort.

---

## Confirmed issues

### 1. `midDayPullDate` is derived from the clock, not the data
**Where:** `src/app/pages/ProcessPayroll.tsx:427`
**Risk:** low today — confirmed 2026-08-11 that payroll is always processed the
same calendar day as the pull.

The mid-day pull backfill fires only when the day being processed matches
`midDayPullDate`, which is computed as `new Date()` at *processing* time rather
than the date the Teramind data was actually pulled. Those agree only when both
happen on the same calendar day.

If a pull at 1 PM were ever processed after midnight, the backfill would not
fire and **every employee would show a 240-minute discount** on that day.

The fix already exists in the same file: `ProcessPayroll.tsx:641-644` computes
the maximum date across the uploaded Teramind rows for the "Coverage" label.
That value *is* the pull date and should feed `midDayPullDate`.

Covered by tests `H2` and `H2b` in `tests/hardcoding.test.ts`.

### 2. The mid-day pull checkbox label is wrong
**Where:** `src/app/pages/ProcessPayroll.tsx:659`
**Risk:** none to numbers; misleads the operator.

The label reads `— assigns 4:00 PM default exit`. The engine assigns each
employee's DST-aware *scheduled* end, not a fixed 4:00 PM. A hardcoded 4:00 PM
is the exact defect test `H2` was written to prevent — the behavior was fixed
and the label never updated.

### 3. Timezone seam between Teramind dates and machine-local dates
**Where:** `src/app/lib/teramindParser.ts:179-188` vs
`src/app/lib/classificationEngine.ts:496-511`
**Risk:** latent.

Teramind exports carry US Eastern wall-clock times and are parsed without
conversion, so date keys are Eastern calendar days. `pullDate` is derived from
the machine's local calendar day (Panama, UTC-5, no DST). During US DST these
disagree between 11 PM and midnight local.

Harmless for the current mid-day-pull use, but this is the same class of bug as
the ten timezone migrations already in the history. Belongs in `AGENTS.md` as an
invariant so it stops being reintroduced.

### 4. Period count mismatch
**Where:** observed in the browser console on the Summary dashboard.
**Risk:** unknown — not yet investigated.

`loadSummaryAllPeriods` returns 11 rows while `loadPeriods` returns 10. May be
a legitimate aggregate row, may be a duplicate or orphaned period.

---

## Structural

### 5. Six files are too large to edit reliably
**Risk:** this is the root cause of "I asked for one thing and something else
broke."

| File | Size |
|---|---|
| `src/app/pages/ProcessPayroll.tsx` | 53 KB |
| `src/app/pages/PayrollMaster.tsx` | 43 KB |
| `src/app/pages/admin/AdminEmployeeSync.tsx` | 36 KB |
| `src/app/lib/classificationEngine.ts` | 35 KB |
| `src/app/pages/ActionRequired.tsx` | 34 KB |
| `src/app/pages/admin/AdminLookups.tsx` | 30 KB |

Deliberately **not** split preemptively: refactoring a file this size *through*
UIB is itself the riskiest available operation. Split each one immediately
before substantial work begins in it, with the export diff already in place to
catch collateral damage.

---

## Reported by the user, not yet diagnosed

- Wrong numbers — payroll totals, tardiness classification, discounts,
  attendance figures.
- Timezone and date bugs.
- UX that is not intuitive.
- A feature backlog blocked by fear of regression.

Each needs a specific reproduction before it can be worked. "The June numbers
look off" is a usable starting point; the first step is finding the row that
proves it.

---

## Notes

Runtime logs were clean on 2026-08-11 — 0 errors, 0 warnings, all 10 actions
succeeding. The wrong-number problems are silent logic errors, not crashes, so
log-watching will not find them. Tests and export diffs will.
