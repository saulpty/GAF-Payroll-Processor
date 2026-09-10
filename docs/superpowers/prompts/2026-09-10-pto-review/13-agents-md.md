# 13 — AGENTS.md: round-2 PTO rules and the period-name guard

## Files you may change

- `src/AGENTS.md` — documentation only

**No other file.** No code changes.

## Changes

1. In the `/pto` paragraph, after the sentence about `pto/PtoPayrollCell.tsx`,
   add: *The column is **Review**, not Pending: `review_count` /
   `waiting_count` in `loadPtoBalancesInputs` (flat `today` param) count only
   requests whose return date has passed and whose leave date sits inside a
   processed cycle (or that end before payroll history began). The row Record
   button, the record-mode dialog and `loadPtoReviewCount` (nav badge) all
   defer to `recordability()` in `lib/ptoPayrollMatch.ts`: invalid dates →
   future → payroll not processed → ok. Edit and Add manually keep only the
   "return date has passed" rule. `byType[].impact` carries `pay_impact_1`
   and is shown on every event line. A request whose return is before its
   leave gets a red chip in the row. Saves refresh in place — `PtoBreakdown`
   takes a `refreshToken` prop and reloads without remounting; the table
   never unmounts while refetching.*

2. In the pure-modules list, under `ptoPayrollMatch.ts`, add a bullet:
   - **`periodName.ts`** — `normalizePeriodName`, `isCanonical`
     (`Q1-Aug-2026` shape), `nearMatch` (case/punctuation, prefix within two
     characters, or one edit away from an existing name; an exact match is a
     re-run, not a near match). Used by `ProcessPayroll.tsx` before a run.
     5 tests in `tests/periodName.test.ts`.

3. In the `periods` section of the schema notes, add: *`period_name` has a
   `NOT VALID` CHECK (`periods_name_shape`, migration `1782000000`) requiring
   `Q1|Q2-Mon-YYYY`; the two legacy free-text names predate it and stay.
   Background: `docs/findings/2026-09-10-q1-aug-duplicate-period.md`.*

4. In the context notes (where `periodsVersion` is described, or next to
   `GlobalFilterContext` in the file map), add: *`ptoVersion` /
   `bumpPtoVersion` — bumped after every PTO write; `TopNav` refetches the PTO
   review badge on it.*
