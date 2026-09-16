# 02 — Employee panel: show Entry / Exit in 12-hour time (5:01 PM, not 17:01)

## Files that may change

- `src/app/pages/attendance/AttendancePanel.tsx`

No other file may be touched. Do not change `loadAttendanceDaily.ts`, the view, or
`attendanceStats.ts` — the calculations read the `HH24:MI` values and must keep them.

## Why

Saul: the Recent Activity table shows exit as `17:01` and entry as `09:17`. Show `5:01 PM` / `9:17 AM`.
Display only.

## Changes

1. Directly after the existing `fmtMinutes` function, add:

```ts
/** "17:01" or "09:17" -> "5:01 PM" / "9:17 AM"; blank -> "—"; anything else unchanged. */
function fmtClock(t: string | null | undefined): string {
  const s = (t ?? '').trim();
  if (!s) return '—';
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  return fmtMinutes(Number(m[1]) * 60 + Number(m[2]));
}
```

2. In `ArrivalTooltip`: `{p.entry_time ?? '—'}` becomes `{fmtClock(p.entry_time)}`.

3. In the Recent Activity table:
   - `<td className="px-3 py-2">{r.entry_time ?? '—'}</td>` becomes
     `<td className="px-3 py-2 whitespace-nowrap">{fmtClock(r.entry_time)}</td>`
   - `<td className="px-3 py-2">{r.exit_time ?? '—'}</td>` becomes
     `<td className="px-3 py-2 whitespace-nowrap">{fmtClock(r.exit_time)}</td>`

Nothing else changes.

## Acceptance

1. Lint clean.
2. No other `entry_time` / `exit_time` display remains unformatted in this file.

Do not build anything else.
