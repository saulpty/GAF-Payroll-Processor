# 01 — Show the people who are off today, and stop counting them as Scheduled

**Only these three files may change. No other file may be touched.**

- `src/app/pages/attendance/AttendanceToday.tsx`
- `src/app/pages/attendance/TodayTiles.tsx`
- `src/app/pages/attendance/TodayRow.tsx`

Do not create files. Do not touch any action, lib or migration. `AttendanceToday.tsx` is 14,725
bytes against a 15,360 cap — **keep it under the cap**; the change below is roughly size-neutral, so
do not add anything extra.

## Why

Marcela Gordon manages Intake 1. Two of her nine people — Euclides Gonzalez and Michael Antonio
Jones Roye, both on the "Weekend Schedule Mon-Tue OFF" — disappeared from her Today board on a
Tuesday, while showing normally on Activity. They were not missing: they were off, and Today drops a
row whose status is `day_off` with zero records. A manager cannot tell "off today" from "gone".

Second, smaller bug found at the same time: her board read **7 Scheduled** when six people were
scheduled. Cemiriamiz Iglesias is off on Tuesdays but worked anyway, so his `day_off` row is in the
table and `scheduledCount` counted it.

## 1. `src/app/pages/attendance/AttendanceToday.tsx`

**a.** Replace the `rows` memo — everyone stays in the table now. `buildToday` already sorts
`day_off` near the end, so off-today people land at the bottom without any extra sorting.

Replace:

```ts
  // Drop day_off rows with zero records from the visible table and tile counts
  const rows = useMemo(() =>
    allRows.filter(r => !(r.status === 'day_off' && r.records === 0)),
    [allRows]
  );
```

with:

```ts
  // Everyone the viewer manages. People who are off today stay in the table (buildToday
  // already sorts them to the bottom) and are muted by TodayTableRow.
  const rows = allRows;
  const offTodayCount = useMemo(
    () => allRows.filter(r => r.status === 'day_off' && r.records === 0).length,
    [allRows],
  );
```

**b.** Fix the Scheduled count. Replace:

```ts
  // Tile counts also exclude day_off (rows already filtered)
  const scheduledCount = rows.filter(r => r.status !== 'holiday').length;
```

with:

```ts
  // Expected to work today: not a holiday, not a day off, not a future start date.
  // A day-off row is excluded even when the person worked anyway.
  const scheduledCount = rows.filter(
    r => r.status !== 'holiday' && r.status !== 'day_off' && r.status !== 'not_started',
  ).length;
```

**c.** Pass the new count to the tiles — add one prop to the existing `<TodayTiles …>`:

```tsx
              offTodayCount={offTodayCount}
```

Nothing else in the file changes. `onLeaveCount` and `noRecordsCount` keep their current
definitions: both test for `late_not_in`, so the day-off rows now in `rows` cannot affect them.

## 2. `src/app/pages/attendance/TodayTiles.tsx`

Add `offTodayCount: number;` to `TodayTilesProps`, accept it in the destructured arguments, and
render one more tile **immediately after the "On Leave" tile**, only when the count is above zero:

```tsx
      {offTodayCount > 0 && (
        <SummaryTile
          label="Off Today"
          value={offTodayCount}
          accent="text-slate-500"
          tip="Their schedule gives them the day off and no activity was recorded. They are listed, greyed out, at the bottom of the table."
        />
      )}
```

Also correct the Scheduled tile's tooltip, which no longer describes what it counts. Replace

```
        tip="Total employees expected to work today (excludes holidays and days off with no activity)."
```

with

```
        tip="Employees expected to work today. Excludes holidays and anyone whose schedule gives them the day off."
```

## 3. `src/app/pages/attendance/TodayRow.tsx`

Grey out the rows of people who are off today and recorded nothing. Just above the `return (`, add:

```ts
  const offToday = row.status === 'day_off' && row.records === 0;
```

and change the opening `<tr>` from

```tsx
    <tr className="hover:bg-slate-50 transition-colors">
```

to

```tsx
    <tr className={`hover:bg-slate-50 transition-colors${offToday ? ' opacity-60' : ''}`}>
```

Nothing else in the file changes — the Day Off chip, the tooltip and every cell stay as they are.
A person who is off but **did** work keeps full opacity, because their `records` are above zero.

## How I will check it

- As Marcela on a Tuesday: nine rows, with Euclides Gonzalez and Michael Antonio Jones Roye greyed
  out at the bottom carrying the Day Off chip, an **Off Today — 2** tile, and **Scheduled 6**
  (Cemiriamiz worked on his day off and is no longer counted as scheduled).
- On Saturday Sep 19 the board is unchanged from today's behaviour for the people who work weekends.
- A super user's board still shows the whole company with the off-today people at the bottom.
