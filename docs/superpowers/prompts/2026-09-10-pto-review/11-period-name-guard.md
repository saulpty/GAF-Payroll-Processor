# 11 — Period-name guard: no more `Q1-Aug-20260`

A payroll period was run twice, once as `Q1-Aug-2026` and once as
`Q1-Aug-20260`, leaving two sets of payroll rows for the same days. The name
is typed free-text and nothing checks it. Saul explicitly authorised this
edit to `ProcessPayroll.tsx` (2026-09-10) — **keep it to the lines below.**

## Files you may change

- `src/app/pages/ProcessPayroll.tsx` — the four edits in §1 only
- `src/migrations/1782000000_periods_name_shape.sql` — **new**

**No other file.** `src/app/lib/periodName.ts` already exists (prompt 06);
do not modify it. Do not touch anything else in `ProcessPayroll.tsx`: no
reformatting, no other logic, no new `cfgGet` fallbacks (a guard counts them).

## 1. `ProcessPayroll.tsx`

a. Import: `import { normalizePeriodName, isCanonical, nearMatch } from '@/app/lib/periodName';`

b. In `handleRun`, right after the existing block

```ts
    if (!periodName || !startDate || !endDate || !teramindFile) {
      setError('Complete all required fields: Period Name, Start Date, End Date, and Teramind file.');
      return;
    }
```

add:

```ts
    const cleanName = normalizePeriodName(periodName);
    if (!isCanonical(cleanName)) {
      setError(`Period name must look like Q1-Aug-2026 (Q1 or Q2, three-letter month, four-digit year). You typed "${cleanName}".`);
      return;
    }
    const near = nearMatch(cleanName, [...existingNames]);
    if (near) {
      setError(`"${cleanName}" looks like the existing period "${near}". To re-run it, pick "${near}" from the list instead of typing a new name.`);
      return;
    }
```

(`existingNames` is the `Set<string>` already built from `loadPeriods`; spread
it into an array for `nearMatch`.)

c. The value written to the database must be the trimmed one. In the three
places that write `periodName` — the `saveSnapshot` / entries object
(`periodName,` around line 429), the soft-delete params (`period_name:
periodName` and `deleted_by: \`reprocess-${periodName}\`` around 484–489) and
`upsertPer({ period_name: periodName, … })` around line 500 — use
`periodName.trim()` instead. Also the three `saveSnapshot({ periodName, … })`
calls around line 343–345. Do not change `isRerun` (it already trims).

d. Nothing else. `formReady`, the input, the quick-fill list, the run log are
untouched.

## 2. Migration `src/migrations/1782000000_periods_name_shape.sql`

```sql
-- 2026-09-10. A period was run twice under "Q1-Aug-2026" and "Q1-Aug-20260".
-- From now on a period name must have the canonical shape. NOT VALID so the
-- two legacy free-text names ("Test Period May 25th - Jun 10th",
-- "Planilla 2 Junio 2026 11-19") stay; new and renamed rows are checked.
-- Rollback: ALTER TABLE periods DROP CONSTRAINT periods_name_shape;
ALTER TABLE periods
  ADD CONSTRAINT periods_name_shape
  CHECK (period_name ~ '^Q[12]-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-[0-9]{4}$')
  NOT VALID;
```

Apply it to the GAF Planilla DB. Confirm afterwards with
`SELECT conname, convalidated FROM pg_constraint WHERE conname = 'periods_name_shape';`
(expect one row, `convalidated = false`).

## Verify

On `/process` (do not run payroll):
1. Type `Q1-Aug-20260` → the red error names `Q1-Aug-2026` as the look-alike.
2. Type `q1-aug-2026` → the shape error.
3. Type an existing name exactly → the amber re-run banner as today, no error.
4. `tests/lessonGuards.test.ts` L4 still passes (14 fallbacks); H4 clean;
   `git status --short` shows only the two files.
