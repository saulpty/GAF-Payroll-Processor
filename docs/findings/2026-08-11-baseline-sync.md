# Baseline sync — 2026-08-11 export

Source: `Downloads\GAF HR Hub.zip` (142 files, uiBakeryVersion 3.192.0-rc.0)

## Sync result
- Added: 17 files
- Changed: 33 files
- Removed: 2 files — `src/app/pages/admin/AdminGraceList.tsx`, `src/app/pages/admin/AdminMacbookSwap.tsx`

A prior throwaway run by a reviewer measured 18 added / 32 changed / 2 removed
(same total of 50 non-removal changes). This run measured 17 added / 33
changed — the boundary between "added" and "changed" is one file, most
likely `datasources.yml` or `version.yml` being counted differently
depending on whether the throwaway checkout already had a placeholder for
it. The removed set is byte-for-byte the required two files, so this is not
treated as a blocker per the task's stop condition (which only fires on an
unexpected `removed` list).

## Idempotency check
A second run of `node tools/sync-export.mjs "C:\Users\SaulFallembaum\Downloads\GAF HR Hub.zip"`
immediately after the first reported `added: 0`, `changed: 0`, `removed: 0`,
confirming the mirror is exact and the tool is deterministic.

## Test results after sync
- Before: 56 passing, 0 failing
- After: 55 passing, 1 failing

### Failures

**`H2: mid-day pull backfills exit to the scheduled end (9-5 employee)`**
(`tests/hardcoding.test.ts:54`, exercises `runClassificationEngine` in
`src/app/lib/classificationEngine.ts`)

Assertion `result[0].exit_time === '5:00 PM'` failed — actual value was
`'1:00 PM'` (the raw, un-backfilled Teramind exit).

Judgement: **test encodes an obsolete assumption.**

Evidence: the exported engine now takes an optional `midDayPullDate`
(defaults to `toLocalYMD(new Date())`, i.e. the real wall-clock date) and
only applies the mid-day-pull exit backfill when `dateStr === pullDate`:

```
const pullDate = midDayPullDate ?? toLocalYMD(new Date());
if (tmEntry && midDayPull && dateStr === pullDate) { ... }
```

The old code (still in the pre-sync `src/`) backfilled *any* day in the
period once `midDayPull: true` was set, with a comment noting schedules
"end at 3/4/5 PM depending on the person and season" — it had no per-date
gate at all. The new code's comment explains the intent directly: "Only
apply the backfill on the specific date the export was pulled... Prior
days in the period already have complete data and should NOT be altered."
That is a deliberate correctness fix in UIB (the old version would have
clobbered legitimately early exits on prior, fully-populated days), not a
regression.

The test calls `baseInput({ midDayPull: true, teramindData: tm })` with a
fixed fixture date (`DAY = '2026-06-15'`) and never supplies
`midDayPullDate`. Under the new contract `pullDate` falls back to the
actual current date the test happens to run on (2026-08-11 in this
session), which never equals the fixture's `2026-06-15`, so the new,
narrower date gate never fires and the backfill is skipped. The test needs
to be updated to pass `midDayPullDate: DAY` to exercise the intended path;
it was written against the old, dateless backfill contract and was not
updated when UIB added the parameter.

No other test references the two APIs that changed alongside this
(`midDayPullDate`, and the removed `tft_late_red_threshold_minutes` config
key) — a repo-wide search of `tests/` confirms only this one test touches
mid-day-pull behavior.

## Notes
- `src/AGENTS.md` is 0 bytes in this export — addressed in Task 7.
- `src/migrations/applied.txt` disagrees with the previous local ledger —
  addressed in Task 6. Specifically, this sync's diff to `applied.txt`
  *removes* 13 previously-recorded entries (`1781400000` through
  `1781401400`) and adds 2 new ones (`1781803200`, `1781803300`), even
  though all of the corresponding `.sql` files for the removed entries are
  still present on disk in `src/migrations/`. The export also adds 9 new
  migration `.sql` files in total (`1781401500` through `1781402100`, plus
  the 2 that made it into the ledger), of which only 2 are marked applied.
  This ledger/filesystem disagreement is left untouched per Task 6's scope.
