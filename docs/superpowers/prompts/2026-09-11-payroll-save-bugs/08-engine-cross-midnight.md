# 08 — Engine: a session that crosses midnight is not an early leave


## Files that may change

- `src/app/lib/classificationEngine.ts` — only the "Normal day with data"
  block, the three lines after `early_leave_minutes` is computed.

No other file may be touched. Do not reformat, reorder or "clean up"
anything else in this file.

## Why

`processTeramindData` keys a session by the date it started and keeps the
latest exit, so a session that runs past midnight leaves an exit `Date` on
the next day. The engine then uses only `exit.getHours()*60+getMinutes()`,
reads 00:35 as the exit, and charges `17:00 − 00:35 = 985` early minutes
(Luis Abad, 2026-06-01). The edit path (`punchMinutes.ts`) already treats
exit-before-entry as past-midnight with early leave 0; the engine must agree
so a payroll re-run does not re-create the 985.

Timezone invariant: no change to how dates or times are read; the only new
comparison is between two integer minutes-since-midnight values the engine
already computes (`entryMins`, `exitMins`). Columns affected:
`early_leave_minutes` (0 instead of a wrong large number) and `auto_notes`
(one appended sentence). `exit_time` stays the truthful punch string.

## The change

Immediately after the line
`const early_leave_minutes = Math.max(0, schedEndMins - exitMins);`
change that `const` to `let` and add:

```ts
      // Exit earlier than entry on the clock means the session ran past
      // midnight (the parser keeps the latest exit of the day). That is not
      // an early leave; leave the operator a note instead of charging minutes.
      let pastMidnightNote = '';
      if (exitMins < entryMins) {
        early_leave_minutes = 0;
        pastMidnightNote = ' Session ran past midnight (exit next day) — early leave not assessed.';
      }
```

Then, where `autoNotes` is finalised — just before the
`if (late_minutes === 0 && early_leave_minutes === 0) { autoNotes = 'On time, full shift.'; ... }`
block — no change; instead, right after that block add:
`if (pastMidnightNote) autoNotes += pastMidnightNote;`
so the note survives the "On time, full shift." reset.

Nothing else changes. `late_minutes`, `late_after_grace`, tardiness and
early-leave event slotting all keep their current logic; the early-leave
branch simply no longer fires for a past-midnight session because
`early_leave_minutes` is 0.

## Test to add (hand-written, `tests/crossMidnight.test.ts`)

Using the `weekendSchedule.test.ts` fixture on Monday 2026-06-15:
`entry = new Date(2026, 5, 15, 4, 50)`, `exit = new Date(2026, 5, 16, 0, 35)`
→ `early_leave_minutes === 0`, `exit_time === '12:35 AM'`, `auto_notes`
matches `/past midnight/`, no `Salida Temprano` in either slot. Regression:
same-day exit `16:00` → `early_leave_minutes === 60` and `Salida Temprano`
present. `punchMinutes.test.ts` PM6 must stay green.

Then confirm every identifier used in the file is imported.
