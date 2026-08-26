# Revert the `toLocalYMD` import in `attendanceStats.ts` only

The previous change added `toLocalYMD` to three files. Two are correct and must
stay. **The third broke the test suite and must go back.**

## What broke

`src/app/lib/attendanceStats.ts` gained:

```ts
import { toLocalYMD } from './classificationEngine';
```

That resolves fine in the app's bundler, but `node --test` runs the TypeScript
directly and Node's ESM resolver requires a file extension. `tests/attendanceStats.test.ts`
imports this module, so the whole test file now fails to load:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../src/app/lib/classificationEngine'
imported from .../src/app/lib/attendanceStats.ts
```

`attendanceStats.ts` had **no imports at all** before this change. That is why it
is the one module in `src/app/lib` a test can import directly.

## Change — one file only

In **`src/app/lib/attendanceStats.ts`**:

1. Delete the line `import { toLocalYMD } from './classificationEngine';` and the
   blank line added with it, so the file starts with
   `export const EXCUSED_STATUSES` exactly as it did before.
2. Restore line ~245 inside `computeTrends` to:
   ```ts
   const today = new Date().toISOString().slice(0, 10);
   ```
3. Add this comment directly above that line, so the next reader knows it is
   deliberate and not an oversight:
   ```ts
   // NOTE: toISOString is normally forbidden here (see AGENTS.md) - it returns
   // the UTC date, which is tomorrow after 19:00 Panama time. It is kept only
   // because this module must stay import-free: importing toLocalYMD from
   // classificationEngine breaks `node --test`, which cannot resolve extensionless
   // imports. Impact is limited to the partial-period marker at a week boundary.
   // Proper fix is to pass today's date in as a parameter from the caller.
   ```

## Do not touch

- **`src/app/context/GlobalFilterContext.tsx`** — keep its `toLocalYMD` import
  and `fmt`. It is correct and must not be reverted.
- **`src/app/pages/Attendance.tsx`** — keep its `toLocalYMD` import, `today()`
  and `daysAgo()`. Correct, must not be reverted.
- Do not add a local copy of `toLocalYMD` to `attendanceStats.ts`. One definition
  of that function is deliberate; this codebase has around ten migrations that
  are all successive fixes to the same timezone bug, and a second copy that could
  drift is exactly the wrong trade.
- **No other file may be touched.**

## Acceptance criteria

- `src/app/lib/attendanceStats.ts` has **zero import statements** again.
- The Attendance dashboard still loads; Trends still renders and still marks the
  last period as partial.
- 60-day window figures unchanged: `DAYS TRACKED` 1428, `ON-TIME RATE` 63.5%,
  `LATE — UNREPORTED` 245.

Then confirm every identifier used in the file is imported.
