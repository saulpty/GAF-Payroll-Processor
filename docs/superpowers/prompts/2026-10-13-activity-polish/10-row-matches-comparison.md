# Activity: the row shows the same averages as the Before and After table

**Make exactly the edits below, character for character. These are small, targeted edits: do not
rewrite, reformat, reorder or "improve" anything else in any file. If your context is compacted
mid-task, re-read this prompt before writing.**

**Only these two files may change:** `src/app/lib/activityTrend.ts` and
`src/app/pages/attendance/activity/ActivityByEmployee.tsx`. **No other file may be touched.** In particular do not edit
`src/app/lib/activityDays.ts`: the side panel and the top cards keep their own figures.

## Why (Saul, 2026-10-13)
Lilian Barría, Sep 17 – Oct 13: her row said Avg Entry **9:18 AM** while the Before and After table under it
said **8:54 AM**. The row averaged every day with work, including Sunday Oct 4, a day off she worked from
4:35 PM. The comparison counts only scheduled work days and leaves today out, so one day-off shift moved the
row by 24 minutes and the red arrow sat beside a number it was not describing. The row now shows the
comparison's own figures for the selected period (`trend.after`), so the two always agree. Day-off work still
appears in the day list with its Day Off tag.

## 1. `src/app/lib/activityTrend.ts`

Edit 1. Replace

```ts
  avgActiveMin: number | null; avgEntryMin: number | null;
```

with

```ts
  avgActiveMin: number | null; avgEntryMin: number | null; avgExitMin: number | null;
```

Edit 2. Replace

```ts
    avgEntryMin: avg(worked.map((d) => d.firstMin)),
```

with

```ts
    avgEntryMin: avg(worked.map((d) => d.firstMin)),
    avgExitMin: avg(worked.map((d) => d.lastMin)),
```

## 2. `src/app/pages/attendance/activity/ActivityByEmployee.tsx`

In `EmployeeRow`, `a` is already `trend.after`. In `sortEmployees`, `t` is already `trends[e.employeeId]`.

Edit 1. Replace

```tsx
          <span className="font-medium">{emp.daysWorked}</span>
          <span className={MUTED}> / {emp.scheduledDays}</span>
```

with

```tsx
          <span className="font-medium">{a.worked}</span>
          <span className={MUTED}> / {a.scheduled}</span>
```

Edit 2. Replace

```tsx
          <ActiveBar activeMin={emp.avgActiveMin} shiftMin={shift} />
```

with

```tsx
          <ActiveBar activeMin={a.avgActiveMin} shiftMin={shift} />
```

Edit 3. Replace

```tsx
          {emp.avgFirstMin !== null ? fmtClock(emp.avgFirstMin) : '—'}
```

with

```tsx
          {a.avgEntryMin !== null ? fmtClock(a.avgEntryMin) : '—'}
```

Edit 4. Replace

```tsx
        <td className={TD}>{emp.avgLastMin !== null ? fmtClock(emp.avgLastMin) : '—'}</td>
```

with

```tsx
        <td className={TD}>{a.avgExitMin !== null ? fmtClock(a.avgExitMin) : '—'}</td>
```

Edit 5. Replace

```tsx
    if (key === 'daysWorked') return e.daysWorked;
    if (key === 'avgActiveMin') return e.avgActiveMin ?? -1;
    if (key === 'avgFirstMin') return e.avgFirstMin ?? -1;
    if (key === 'avgLastMin') return e.avgLastMin ?? -1;
```

with

```tsx
    // Same figures the row shows: the comparison's days (scheduled work days, today left out).
    if (key === 'daysWorked') return t ? t.after.worked : 0;
    if (key === 'avgActiveMin') return t ? t.after.avgActiveMin ?? -1 : -1;
    if (key === 'avgFirstMin') return t ? t.after.avgEntryMin ?? -1 : -1;
    if (key === 'avgLastMin') return t ? t.after.avgExitMin ?? -1 : -1;
```

## Acceptance (Attendance → Activity, By Employee)
1. Open any employee: Avg Active and Avg Entry in the row equal the After column of the Before and After table.
2. Days With Work in the row reads the same count as the "of N" in Low Activity Days (e.g. 18 / 18 and 5 of 18).
3. Sorting by Avg Active, Avg Entry, Avg Exit or Days With Work orders by the numbers shown.

When done, reply with a one-line summary per file.
