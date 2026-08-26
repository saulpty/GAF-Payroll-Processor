# `parseWallClock` must never accept a timestamp that carries a timezone

**`src/app/lib/teramindParser.ts` is a protected file.** Saul asked for this
change directly. Change nothing in it except what is written below.

## The rule this protects

Teramind exports are **already US Eastern wall-clock**. The parser must return a
`Date` whose `.getHours()` / `.getMinutes()` equal the literal digits in the
string, with no timezone conversion — that is what the docblock at line 118-124
promises and what the `m24` branch delivers via the explicit
`new Date(y, m, d, hh, mm, ss)` constructor.

## The defect

The fallback at line 142-144:

```ts
// Fallback: try native parse (may be wrong in some TZ, but better than nothing)
const d = new Date(s);
return isNaN(d.getTime()) ? null : d;
```

`parseWallClock` runs on **every row of every Teramind upload**
(`teramindParser.ts:182-183`), so this is reachable in normal use, not a dead
branch. Its result feeds `entry_time` / `exit_time`, and from there
`late_minutes` and `discount_total_minutes` — so a wrong value here moves money.

**Be precise about what is wrong with it.** For a string with **no** timezone
information — `8/26/2026 9:05 AM`, `Aug 26 2026 09:05` — `new Date(s)` parses in
**local** time, which is the correct wall-clock result. That case is fine and
must keep working; dropping it would throw away real punches.

The failure is a string that **does** carry a timezone: a trailing `Z`, or a
`+HH:MM` / `-HH:MM` offset. `new Date('2026-08-26T09:05:00Z')` is an instant, and
`.getHours()` then returns whatever that instant is in the *browser's* zone —
silently shifting the punch by hours. That is the exact class of bug the ten
`fix_tz_*` migrations were written to undo.

## The change

Replace **only** the fallback block at lines 142-144 with a guarded version:

1. Before calling `new Date(s)`, test the string for explicit timezone
   information. Treat it as timezone-bearing if it ends with `Z` (case
   insensitive) or contains a `+HH:MM`, `-HH:MM`, `+HHMM` or `-HHMM` offset after
   the time portion. Be careful not to match the `-` separators in a
   `YYYY-MM-DD` date.
2. If it is timezone-bearing: **do not parse it.** `console.warn` naming the
   file and the offending string, e.g.
   `[Teramind] Refusing timezone-bearing timestamp (times must be Eastern wall-clock): <s>`
   and `return null`.
3. Otherwise keep the existing behaviour exactly: `const d = new Date(s);`
   then `return isNaN(d.getTime()) ? null : d;`.
4. Replace the misleading comment. It currently reads *"may be wrong in some TZ,
   but better than nothing"* — which is precisely the reasoning that makes this
   dangerous. Say instead that only timezone-free strings are accepted here, and
   that anything carrying an offset is rejected rather than silently shifted.

Returning `null` is already handled safely by the caller: `teramindParser.ts:184-187`
logs `[Teramind] Unparseable dates:` and skips the row. A skipped row is visible
downstream — the day shows as missing data and the coverage check in
`ProcessPayroll` flags it. A silently shifted time is not visible at all. That
asymmetry is the whole point.

## Do not touch

- Do not change the `m24` regex or its branch. It is correct.
- Do not change `processTeramindData`, `toLocalYMD`, the grouping logic, or any
  other function in this file.
- Do not change `classificationEngine.ts` or any other file. **Only
  `src/app/lib/teramindParser.ts` may be modified.**
- Do not reformat the file.

The diff should be confined to the fallback block and its comment.

## Acceptance criteria

- A normal Teramind upload still parses exactly as before. Times shown on
  Payroll Master for a re-processed period are unchanged.
- `parseWallClock('2026-08-26 09:05:00')` and `parseWallClock('2026-08-26 09:05 AM')`
  still return 09:05 local wall-clock — these go through the `m24` branch and must
  be untouched.
- A timezone-bearing string now returns `null` and logs the refusal, instead of
  returning a shifted time.

Then confirm every identifier used in the file is imported.
