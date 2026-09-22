# 02 — The keep-fresh sync must heal gaps, and the pull log must not claim the future

**Only these three files may change. No other file may be touched.**

- `src/app/lib/teramindPull.ts`
- `src/actions/loadTeramindPullLog.ts`
- `src/app/pages/process/TeramindSourceCard.tsx`

Do not create files. Do not touch `TeramindAutoSync.tsx`, `TeramindPullCard.tsx`, any migration, or
anything under `src/components/ui/`.

## What went wrong (measured on prod, 2026-09-22)

**Saturday Sep 19 had zero rows in `teramind_sessions`** while Teramind itself held a full day's work
for four people. Euclides Gonzalez read "No Records" on the Today board for a day he worked 4h 29m.

Two independent causes:

1. `keepFreshRange` pulls **yesterday and today only**, and the sync only runs while a super user has
   the Hub open. Nobody opened the Hub on Saturday or Sunday; Monday's pull covered Sunday and
   Monday. Saturday was never in any pull's range and nothing ever reaches back for it.
2. `coversRange` believes a pull covered every day of its recorded range — including days that had
   **not happened yet** when it ran. The log holds a capture from Sep 17 for `2026-09-11 →
   2026-09-25`, so the Process Payroll card would tell Tim the whole Q2-Sep period is a saved copy he
   can reuse, when Sep 19 was missing from it. That is a payroll-grade error: a day of real work
   would enter the engine as an absence.

## 1. `src/app/lib/teramindPull.ts`

**a.** Widen the keep-fresh window so any short gap heals itself the next time somebody opens the
Hub. Replace:

```ts
export function keepFreshRange(todayEastern: string): PullChunk {
  const today = toDayNumber(todayEastern);
  return { from: fromDayNumber(today - 1), to: todayEastern };
}
```

with:

```ts
/** Days the keep-fresh sync re-pulls, counting today. A week covers any weekend or holiday
 *  stretch with nobody signed in; the pull is still a single chunk, so it costs one API call. */
export const KEEP_FRESH_DAYS = 7;

export function keepFreshRange(todayEastern: string, days: number = KEEP_FRESH_DAYS): PullChunk {
  const span = Number.isFinite(days) && days >= 1 ? Math.floor(days) : KEEP_FRESH_DAYS;
  const today = toDayNumber(todayEastern);
  return { from: fromDayNumber(today - (span - 1)), to: todayEastern };
}
```

`TeramindAutoSync.tsx` calls `keepFreshRange(easternDate(Date.now()))` and is **not** edited — the
default parameter does the work.

**b.** A pull cannot cover a day that had not happened when it ran. Widen the accepted row type with
two optional fields and clamp each entry's end. Replace the signature and the covered-set loop of
`coversRange`:

```ts
export function coversRange(
  log: { date_from: string; date_to: string; error: string | null; truncated: boolean }[],
  from: string,
  to: string,
): boolean {
```

with:

```ts
export function coversRange(
  log: {
    date_from: string; date_to: string; error: string | null; truncated: boolean;
    /** Eastern date the pull ran, from loadTeramindPullLog. */
    pulled_ymd?: string | null;
    /** Timestamp fallback when pulled_ymd is absent; only its first 10 characters are read. */
    pulled_at?: string | null;
  }[],
  from: string,
  to: string,
): boolean {
```

and inside, replace:

```ts
    const start = toDayNumber(entry.date_from);
    const end = toDayNumber(entry.date_to);
```

with:

```ts
    const start = toDayNumber(entry.date_from);
    // A pull only ever saw days up to the day it ran; a range reaching into the future
    // (a capture entered before the period ended) covers nothing past that day.
    const ranOn = (entry.pulled_ymd ?? entry.pulled_at ?? '').slice(0, 10);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(ranOn)
      ? Math.min(toDayNumber(entry.date_to), toDayNumber(ranOn))
      : toDayNumber(entry.date_to);
```

Nothing else in the file changes. Keep the file pure — no new imports.

## 2. `src/actions/loadTeramindPullLog.ts`

Add one column to the SELECT so the clamp uses the Eastern date rather than a UTC timestamp. After
`pulled_at,` add:

```sql
        to_char(pulled_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS pulled_ymd,
```

Nothing else in the action changes — same table, same WHERE, same ORDER BY, same LIMIT.

## 3. `src/app/pages/process/TeramindSourceCard.tsx`

This card re-maps the log into a narrower object, which would drop the new field. In the `logRows`
memo, inside the `.map(r => ({ … }))`, after the `pulled_at:` line add:

```ts
        pulled_ymd: r.pulled_ymd ? String(r.pulled_ymd) : null,
```

Nothing else in the file changes.

## How I will check it

- Process Payroll with the Q2-Sep dates (2026-09-11 → 2026-09-25) no longer claims a saved copy from
  the Sep 17 capture; it offers a fresh capture instead.
- The Teramind tab still shows the pull log with its existing columns.
- `keepFreshRange('2026-09-22')` returns `2026-09-16 → 2026-09-22`, so Monday's sync would have
  pulled Saturday.
