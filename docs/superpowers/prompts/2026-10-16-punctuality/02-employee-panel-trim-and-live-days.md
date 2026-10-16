# Attendance employee panel: no ring charts, no Status column, and the same numbers wherever it opens

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these files may change.** Five edited: `src/app/pages/attendance/AttendancePanel.tsx`,
`src/app/pages/attendance/AttendancePanelBody.tsx`, `src/app/pages/attendance/AttendancePanelDays.tsx`,
`src/app/pages/attendance/AttendancePanelDayRows.tsx`, `src/app/pages/attendance/useEmployeeStats.ts`.
One deleted: `src/app/pages/attendance/AttendanceDonuts.tsx`. **No other file may be touched.**
No migration, no action file (nothing under `src/actions/`), no change to `useLiveListRows.ts`,
`attendanceStats.ts`, `activityDays.ts` or anything under `src/app/pages/attendance/activity/`.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB.
- `useLoadAction` parameters are passed **flat**: `useLoadAction(action, default, { a, b })`,
  never `{ params: { a, b } }`. Every loader keeps its `viewAs`.
- Dates are `YYYY-MM-DD` strings and are compared as strings. Never `new Date(str)` for date math.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

## Why (Saul, 2026-10-16)

Clicking a person on Attendance opens their panel. Three things are wrong with it:

1. **Two ring charts nobody reads.** "Arrival Breakdown" and "Reporting Breakdown" repeat the seven
   small numbers above them. They go. The seven numbers and the Arrival Trend chart stay.
2. **The Status column says nothing new.** On Time = the Late column is empty. Excused / Permission =
   the Why tag already says PTO or Permission. Late - Reported = Late minutes plus the form tag. It
   goes, on the computer table and on the phone rows. (The one thing only Status said, "Late -
   Unreported", becomes a red "Not Reported" Why tag in a separate prompt; this one does not touch it.)
3. **Different numbers depending on where you open it.** Opened from Attendance → List, the panel
   counts the days payroll has not processed yet (from Teramind), exactly as the List does. Opened
   from Today or Activity, it reads payroll only, so those days are missing: Nichole Harris arrived
   9:20 on Wed Oct 14 and the Late column shows "—", and her % On-Time differs from the List. The
   fix makes `useEmployeeStats` add the same not-yet-processed days, the same way `Attendance.tsx` does.

## 1. Delete `src/app/pages/attendance/AttendanceDonuts.tsx`

Delete the file. After step 2 nothing imports it (it was only used by `AttendancePanelBody.tsx`).

## 2. `src/app/pages/attendance/AttendancePanelBody.tsx` — four edits, nothing else

**2a.** Replace

```tsx
import { EmpStats, computeArrivalScatter, ArrivalPoint } from '@/app/lib/attendanceStats';

import { AttendanceDonuts } from './AttendanceDonuts';
import {
```

with

```tsx
import { EmpStats, computeArrivalScatter, ArrivalPoint } from '@/app/lib/attendanceStats';
import {
```

**2b.** Replace (this colour list's only users were the Status column, removed in steps 3 and 4)

```tsx
export const STATUS_COLORS: Record<string, string> = {
  'On Time':                '#2AA876',
  'Late - Reported':        '#FBBF24',
  'Late - Unreported':      '#EF4444',
  'Excused (PTO/FH/Perm)':  '#94A3B8',
  'Permission':             '#6366F1',
  'Absent - Unexplained':   '#B91C1C',
};

function MiniKpi({ label, value, color }: { label: string; value: string | number; color: string }) {
```

with

```tsx
function MiniKpi({ label, value, color }: { label: string; value: string | number; color: string }) {
```

**2c.** Replace

```tsx
  // On a phone only the seven numbers are shown. Everything below this line (the arrival chart
  // and the two ring charts) is never rendered there.
```

with

```tsx
  // On a phone only the seven numbers are shown. Everything below this line (the arrival chart)
  // is never rendered there.
```

**2d.** Replace

```tsx
        </div>
      </div>

      {/* Donuts */}
      <AttendanceDonuts stats={stats} />
    </div>
  );
}
```

with

```tsx
        </div>
      </div>
    </div>
  );
}
```

`PanelNumbers`, `MiniKpi`, the Arrival Trend chart, its tooltip (which colours by `p.color`, not by
`STATUS_COLORS`) and the `isPhone` early return stay exactly as they are.

## 3. `src/app/pages/attendance/AttendancePanelDays.tsx` — three edits, nothing else

**3a.** Replace

```tsx
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { STATUS_COLORS } from './AttendancePanelBody';
import WhyChipBadge from './activity/WhyChipBadge';
```

with

```tsx
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import WhyChipBadge from './activity/WhyChipBadge';
```

**3b.** Replace

```tsx
                  <th className={TH}>Active</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Late</th>
```

with

```tsx
                  <th className={TH}>Active</th>
                  <th className={TH}>Late</th>
```

**3c.** Replace

```tsx
                      <td className={`${TD} tabular-nums`}>{fmtDuration(d.activeMin)}</td>
                      <td className={TD}>
                        {att ? (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              style={{ background: STATUS_COLORS[att.status] ?? '#ccc' }}
                            />
                            <span className="whitespace-nowrap">{att.status}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className={`${TD} tabular-nums whitespace-nowrap`}>
```

with

```tsx
                      <td className={`${TD} tabular-nums`}>{fmtDuration(d.activeMin)}</td>
                      <td className={`${TD} tabular-nums whitespace-nowrap`}>
```

The table now has seven columns: Date, Entry, Exit, Active, Late, Why, Source. `att` is still used
by the Late cell; `attByDate`, `toDateKey`, the sort and the phone branch stay as they are.

## 4. `src/app/pages/attendance/AttendancePanelDayRows.tsx` — three edits, nothing else

**4a.** Replace

```tsx
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import { STATUS_COLORS } from './AttendancePanelBody';
import WhyChipBadge from './activity/WhyChipBadge';
```

with

```tsx
import type { AttendanceRow } from '@/app/lib/attendanceStats';
import WhyChipBadge from './activity/WhyChipBadge';
```

**4b.** Replace

```tsx
        const att = attByDate.get(d.date);
        const dot = att ? STATUS_COLORS[att.status] : undefined;
        const first = d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—';
```

with

```tsx
        const att = attByDate.get(d.date);
        const first = d.shownFirstMin !== null ? fmtClock(d.shownFirstMin) : '—';
```

**4c.** Replace

```tsx
            tone={d.needsLook ? 'yellow' : 'none'}
            right={att ? (
              <span className="inline-flex items-center gap-1 text-[12px] text-slate-700 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-300" style={dot ? { background: dot } : undefined} />
                {att.status}
              </span>
            ) : undefined}
            facts={(
```

with

```tsx
            tone={d.needsLook ? 'yellow' : 'none'}
            facts={(
```

`right` is optional on `MobileRow`; the row simply has nothing pinned right. The facts (times,
"N min late", Needs a Look, Long Break, the Why tag, active time, Early Record) stay as they are.

## 5. `src/app/pages/attendance/AttendancePanel.tsx` — one edit, nothing else

Replace

```tsx
              {/* Attendance KPIs + arrival chart + Donuts */}
```

with

```tsx
              {/* Attendance KPIs + arrival chart */}
```

## 6. `src/app/pages/attendance/useEmployeeStats.ts` — replace the whole file

The file is short; replace all of it with exactly this:

```ts
import { useMemo } from 'react';
import { useLoadAction } from '@uibakery/data';
import { useViewer } from '@/app/context/ViewerContext';
import loadAttendanceDailyAction from '@/actions/loadAttendanceDaily';
import loadAttendanceEmployeesAction from '@/actions/loadAttendanceEmployees';
import { AttendanceRow, EmpInfo, computeEmployeeStats, rowsInRange } from '@/app/lib/attendanceStats';
import type { EmpStats } from '@/app/lib/attendanceStats';
import type { ReportEmployee } from '@/app/lib/attendanceReportTypes';
import { useLiveListRows } from './useLiveListRows';

type Params = {
  email?: string;
  employeeId?: number;
  dateFrom: string;
  dateTo: string;
};

type Result = {
  stats: EmpStats | null;
  loading: boolean;
};

/**
 * One employee's attendance numbers for the panel when the caller has none (Today, Activity).
 * Same days as Attendance → List: payroll rows inside [dateFrom, dateTo], plus the days payroll
 * has not processed yet (useLiveListRows, from Teramind), appended exactly as Attendance.tsx does.
 */
export function useEmployeeStats({ email, employeeId, dateFrom, dateTo }: Params): Result {
  const { viewAs } = useViewer();

  const [empList, loadingEmps] = useLoadAction(
    loadAttendanceEmployeesAction,
    [] as EmpInfo[],
    { viewAs },
  );

  const emps = (empList as EmpInfo[]) ?? [];

  // Resolve email from employeeId if not directly provided
  const resolvedEmail = email ||
    emps.find(e => Number((e as { id?: number }).id) === employeeId)?.email ||
    '';

  const [rawRows, loadingRows] = useLoadAction(
    loadAttendanceDailyAction,
    [] as AttendanceRow[],
    { dateFrom, dateTo, email: resolvedEmail, viewAs },
  );

  // A slower answer for an earlier, wider range can arrive late: keep only the days asked for.
  const rows = useMemo(
    () => rowsInRange((rawRows as AttendanceRow[]) ?? [], dateFrom, dateTo),
    [rawRows, dateFrom, dateTo],
  );

  // Days payroll has not processed yet, for this one person only.
  const oneEmp = useMemo(
    () => (resolvedEmail ? emps.filter(e => e.email === resolvedEmail) : []),
    [emps, resolvedEmail],
  );
  const live = useLiveListRows({
    dateFrom, dateTo, viewAs,
    employees: oneEmp as unknown as ReportEmployee[], official: rows,
  });

  const loading = loadingEmps || loadingRows || live.loading;

  const stats = useMemo<EmpStats | null>(() => {
    // Don't compute until we have a resolved email — avoids whole-company numbers
    if (!resolvedEmail) return null;
    // Wait for the not-yet-processed days, so the numbers never show without them.
    if (live.loading) return null;

    const allRows = live.rows.length > 0 ? [...rows, ...live.rows] : rows;

    const empMap = new Map<string, EmpInfo>();
    emps.forEach(e => empMap.set(e.email, e));

    const matchEmails = new Set<string>([resolvedEmail]);

    const results = computeEmployeeStats(allRows, empMap, matchEmails);
    return results[0] ?? null;
  }, [rows, live.rows, live.loading, emps, resolvedEmail]);

  return { stats, loading };
}
```

What changed from the old file: `rowsInRange` and two imports were added; the payroll rows are
kept inside the range; `useLiveListRows` is called with the same arguments `Attendance.tsx` gives
it (`dateFrom`, `dateTo`, `viewAs`, `employees`, `official`) but for this one employee; its rows are
appended before `computeEmployeeStats`; `loading` includes `live.loading`. Both existing loaders,
their flat parameters and their `viewAs` are unchanged. Every hook is called on every render, in
the same order (no hook inside a condition).

## Acceptance — visible facts

On the computer (load `/dev`, Ctrl+Shift+R first):

1. Attendance → List, click any person: the panel shows the four headline tiles, the seven small
   numbers, the Arrival Trend chart, then Day by Day. **No** "Arrival Breakdown" or "Reporting
   Breakdown" ring charts anywhere.
2. Day by Day has seven columns: Date, Entry, Exit, Active, Late, Why, Source. **No Status column.**
   A late day still shows its minutes in Late.
3. Attendance → Today (or Activity), click Nichole Harris with a range that includes Wed Oct 14:
   that day shows her minutes late in Late (she arrived 9:20), not "—".
4. For the same person and the same date range, the seven small numbers (Expected, On Time, … ,
   % On-Time) are **identical** whether the panel was opened from List, from Today, or from
   Activity → By Employee.
5. No console errors; no "Couldn't Load Activity Data" message where there was none before.

On a phone (375 px wide):

6. The panel sheet shows Day by Day as rows; no row has a status word ("On Time", "Late - Reported",
   …) pinned at the right. Times, "N min late" and the Why tag are still on each row.

When done, reply with a one-line summary per file, and confirm `AttendanceDonuts.tsx` is deleted.
