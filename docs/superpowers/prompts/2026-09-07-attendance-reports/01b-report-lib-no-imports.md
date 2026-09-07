# `attendanceReport.ts` must have no imports

One correction to the module you just created. Everything else about it stays.

## The only file you may change

- `src/app/lib/attendanceReport.ts`

**No other file.** The three new actions and `loadAttendanceEmployees.ts` are
correct as they are — do not touch them.

## What is wrong

`attendanceReport.ts` opens with:

```ts
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from './classificationEngine';
```

The repository's tests run under `node --test` and load these `.ts` files
directly, with no bundler. Node cannot resolve an extensionless relative import,
so the module fails before a single test runs:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/src/app/lib/classificationEngine'
    imported from …/src/app/lib/attendanceReport.ts
```

This problem has already been solved once in this codebase, and the answer is
written at the top of `src/app/lib/mondayResolve.ts`:

> This module deliberately has **NO imports**: callers pass `normalizeName` from
> classificationEngine. That keeps one normalizer in the codebase while letting
> Node's TypeScript loader load this file directly for tests.

Follow that. **Do not** fix this by adding a `.ts` extension to the import, and
**do not** fix it by copying `isScheduledWorkDay`, `getSchedule` or the DST rule
into this file — a second copy of the work-day gate is precisely the kind of
drift that has caused payroll bugs here before.

## The change

Delete the import. Add a required `helpers` field to `ReportInput`, and use it
everywhere those three functions were used:

```ts
export type ReportHelpers = {
  isScheduledWorkDay: (date: Date, workDays: string | undefined) => boolean;
  getSchedule: (
    emp: { dst_start: string; dst_end: string; standard_start: string; standard_end: string; grace_minutes: number },
    date: Date,
    dstWindows: { year: number; us_dst_start: string; us_dst_end: string }[],
  ) => { start: string; end: string; grace: string };
  parseTimeToMinutes: (t: string) => number;
};

export type ReportInput = {
  // …all existing fields unchanged…
  helpers: ReportHelpers;
};
```

Add a comment at the top of the file saying why the module has no imports, in
the same spirit as `mondayResolve.ts`, so the next person does not "helpfully"
add one back.

Callers will pass:

```ts
import { isScheduledWorkDay, getSchedule, parseTimeToMinutes } from '@/app/lib/classificationEngine';
// …
buildAttendanceReport({ …, helpers: { isScheduledWorkDay, getSchedule, parseTimeToMinutes } })
```

No page calls it yet, so there is nothing else to update.

## Acceptance

1. `src/app/lib/attendanceReport.ts` contains **no `import` statement at all**.
2. It does not define its own copy of `isScheduledWorkDay`, `getSchedule`,
   `isDst`, or any DST or work-day logic — all three come through `helpers`.
3. `ReportInput.helpers` is required and typed as `ReportHelpers`, which is
   exported.
4. Every other behaviour, type and export name is unchanged.
5. `git status` shows this one file modified and nothing else.
6. TypeScript clean.
