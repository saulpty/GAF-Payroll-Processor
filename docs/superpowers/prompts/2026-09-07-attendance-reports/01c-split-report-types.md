# Split `attendanceReport.ts` — it is over the 15 KB limit

`src/app/lib/attendanceReport.ts` is **15,936 bytes**. This project's rule is
that a file stays under 15 KB, so it gets split now rather than after a page
starts calling it.

## Files you may change

Create:
- `src/app/lib/attendanceReportTypes.ts`

Modify:
- `src/app/lib/attendanceReport.ts`

**No other file.** No page, no component, no action, no test.

## The split

Move **every `export type`** out of `attendanceReport.ts` and into
`attendanceReportTypes.ts`, unchanged:

`ReportEmployee`, `ReportPayrollRow`, `ReportForm`, `ReportRequest`,
`ReportPeriod`, `ReportHoliday`, `Verdict`, `ReportFormView`, `ReportRow`,
`ReportSummary`, `ReportHelpers`, `ReportInput`, `ReportOutput`.

The runtime constants stay in `attendanceReport.ts`: `AWAY_REQUEST_TYPES`,
`SCORED_VERDICTS`, `PASSTHROUGH_REQUEST_TYPES`, `PTO_REQUEST_TYPES`, every
function, and `buildAttendanceReport`.

## The one rule that makes this work

`attendanceReport.ts` still must have **no runtime import**. It pulls the types
back in with a **type-only** import:

```ts
import type {
  ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest, ReportPeriod,
  ReportHoliday, Verdict, ReportFormView, ReportRow, ReportSummary,
  ReportHelpers, ReportInput, ReportOutput,
} from './attendanceReportTypes';
```

`import type` is erased before the code runs, so Node's TypeScript loader never
resolves that path and the tests keep working. **It must be `import type`, not
`import`** — a plain import reintroduces exactly the `ERR_MODULE_NOT_FOUND`
failure that prompt 01b fixed.

Then re-export the types so existing importers keep working unchanged:

```ts
export type {
  ReportEmployee, ReportPayrollRow, ReportForm, ReportRequest, ReportPeriod,
  ReportHoliday, Verdict, ReportFormView, ReportRow, ReportSummary,
  ReportHelpers, ReportInput, ReportOutput,
};
```

`tests/attendanceReport.test.ts` imports its types from
`../src/app/lib/attendanceReport.ts` and **must not need editing** — that
re-export is what keeps it working. Do not modify the test file.

`attendanceReportTypes.ts` contains only type declarations, so it needs no
imports of its own.

## Acceptance

1. Both files are under 15 KB.
2. `attendanceReport.ts` has exactly one import line, and it starts with
   `import type`.
3. `attendanceReportTypes.ts` has no import at all and exports only types.
4. Every name previously exported from `attendanceReport.ts` is still exported
   from `attendanceReport.ts`.
5. No behaviour changes — this is a pure move.
6. TypeScript clean, and `git status` shows only these two files.
