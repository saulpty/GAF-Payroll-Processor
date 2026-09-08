# Fix "9:54 AM AM" on the Reports tab

Saul spotted this on the live app: every time reads `in 9:54 AM AM`.

## Files you may change

- `src/app/pages/attendance/AttendanceReportStrips.tsx`
- `src/app/pages/attendance/AttendanceReportTable.tsx`

**No other file.**

## The bug, and why it is worse than a doubled suffix

Both files define:

```ts
function fmtTime(t: string | null) {
  if (!t) return '—';
  // t is "HH:MM" or "HH:MM:SS"
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${mm} ${ampm}`;
}
```

The comment is wrong. `entryTime`, `exitTime` and `scheduledStart` come from
`payroll_entries`, where **times are already 12-hour strings with a meridiem** —
`"9:54 AM"`, `"5:00 PM"` (`AGENTS.md`: *"Time columns … are TEXT, US Eastern
wall clock, format `H:MM AM` / `H:MM PM`"*).

So for `"9:54 AM"`: `split(':')` yields `['9', '54 AM']`, `mm` is `"54 AM"`,
`h` is `9`, and the function appends its own `AM` → **`9:54 AM AM`**.

**The meridiem is also recomputed from a 12-hour hour, which is simply wrong.**
`"1:30 PM"` gives `h = 1`, so `h < 12` is true and it renders **`1:30 PM AM`** —
an afternoon time labelled AM. Anything from 1 PM to 11 PM is affected. That is
a correctness bug, not just a cosmetic one, and it is why the fix must not stop
at stripping the duplicate.

## The fix

These values need **no formatting at all** — they are already in the display
format. Replace the body of `fmtTime` in **both** files with a pass-through that
still handles the empty case, and delete the meridiem arithmetic:

```ts
/** Times from payroll_entries are already US Eastern wall clock in
 *  "H:MM AM" / "H:MM PM" form (AGENTS.md). They are displayed as stored —
 *  reformatting them is what produced "9:54 AM AM", and re-deriving the
 *  meridiem from a 12-hour hour turned "1:30 PM" into "1:30 PM AM". */
function fmtTime(t: string | null) {
  const s = (t ?? '').trim();
  return s === '' ? '—' : s;
}
```

Keep the function and both call sites so the empty-value dash still works; only
its body changes. If the two files' versions differ in any other way, make them
identical.

## Verify

On `/attendance/reports`, over a range containing both morning and afternoon
punches:

1. No time anywhere reads `AM AM` or `PM PM`.
2. **An afternoon punch reads PM, not AM.** Alisha Dua has a `12:15 PM` entry on
   2026-08-19; find at least one row after 1 PM and confirm it is not labelled
   AM. This is the check that matters — the duplicate suffix is obvious, the
   wrong meridiem is not.
3. A row with no punch still shows `—`.
4. Both the weekly strips and the All-days table are correct, since both had the
   bug.

## Acceptance

1. Only the two files changed.
2. Neither file computes a meridiem any more.
3. Afternoon times display as PM.
