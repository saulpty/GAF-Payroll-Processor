# The Reports header loses 21 days

## The only file you may change

- `src/app/pages/attendance/AttendanceReport.tsx`

**No other file.** Not the strips, not the table, not the lib, not a test.

## The problem

The summary strip reads:

```
482 Scheduled days   266 On-time   181 Late   14 Absent      55% on-time
```

266 + 181 + 14 = **461**, not 482. The missing 21 are the days someone was
absent *and filed a form* — `absent_reported_on_time` (17) and
`absent_reported_late` (4). They are scored days, they are in the 482, and they
appear nowhere in the header.

A manager reading "14 Absent" concludes 14 people failed to show up. In that
range 35 did; 21 of them told someone first. Both numbers matter and the header
currently shows neither honestly.

## The change

Make the strip account for every scored day:

```
482 Scheduled days   266 On-time   181 Late   35 Absent   14 Unexplained   55% on-time
```

- **Absent** counts all three absence verdicts: `absent_reported_on_time`,
  `absent_reported_late`, `unexplained_absence`.
- **Unexplained** counts `unexplained_absence` alone, and keeps the danger
  colour. It is the number that needs a manager's attention.
- **On-time**, **Late** and **Scheduled days** are unchanged.
- `On-time + Late + Absent` must now equal `Scheduled days`. If it ever does
  not, the report is lying — so derive all four from the same row set rather
  than counting them in separate passes.

Keep the same visual treatment: neutral for scheduled days, green for on-time,
amber for late, red for unexplained. Absent sits between late and unexplained
and can stay neutral so the eye still lands on the unexplained figure.

When the filtered range has no scored days, show `No scored days` instead of
`0% on-time`, matching what the per-employee cards already do.

## Acceptance

1. Only `AttendanceReport.tsx` changed.
2. On-time + Late + Absent equals Scheduled days, for any filter.
3. Unexplained is shown separately and still reads as the urgent number.
4. The per-employee cards and both views are untouched.
