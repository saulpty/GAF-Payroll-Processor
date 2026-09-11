# 18 — Reports → Cards: white day cards with a colour stripe, in → out, six tones

Saul chose mockup "A": a white card with a coloured top stripe, the date as
the anchor, the status as one short coloured line, a single **in → out** time
line, and a small meta row (minutes-late pill, form tick/warning). Six tones:
green on time · amber Reported Ahead · orange Reported After Shift · red no
form / unexplained · sky blue for an absence Reported Ahead · grey for
PTO / permission / holiday / not run.

## Files you may change

- `src/app/pages/attendance/AttendanceReportStrips.tsx`
- `src/app/pages/attendance/AttendanceReportTable.tsx` — the `VERDICT_BADGE` map only

**No other file may be touched.** `attendanceReport.ts`, the verdict rules
and every count stay as they are. `VERDICT_LABEL` (the full wording used by
the Table's filter chips) keeps its exact strings — add a new map for the
card wording, do not edit it. Timezone rule: dates are `YYYY-MM-DD` strings;
no `new Date(...)`.

## AttendanceReportStrips.tsx

1. **Tones.** Replace `TileColor`/`VERDICT_COLOR`/`TILE_BG` with:

```ts
type Tone = 'green' | 'amber' | 'orange' | 'red' | 'sky' | 'grey';
const VERDICT_TONE: Record<Verdict, Tone> = {
  on_time: 'green',
  late_reported_on_time: 'amber',   absent_reported_on_time: 'sky',
  late_reported_late: 'orange',     absent_reported_late: 'orange',
  late_no_form: 'red',              unexplained_absence: 'red',
  pto: 'grey', permission: 'grey', holiday: 'grey', not_processed: 'grey',
};
const TONE: Record<Tone, { stripe: string; dot: string; text: string; pill: string }> = {
  green:  { stripe: 'border-t-green-500',  dot: 'bg-green-500',  text: 'text-green-700',  pill: 'bg-green-50 text-green-700 border-green-200' },
  amber:  { stripe: 'border-t-amber-500',  dot: 'bg-amber-500',  text: 'text-amber-700',  pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  orange: { stripe: 'border-t-orange-500', dot: 'bg-orange-500', text: 'text-orange-700', pill: 'bg-orange-50 text-orange-700 border-orange-200' },
  red:    { stripe: 'border-t-red-500',    dot: 'bg-red-500',    text: 'text-red-700',    pill: 'bg-red-50 text-red-700 border-red-200' },
  sky:    { stripe: 'border-t-sky-500',    dot: 'bg-sky-500',    text: 'text-sky-700',    pill: 'bg-sky-50 text-sky-700 border-sky-200' },
  grey:   { stripe: 'border-t-slate-300',  dot: 'bg-slate-400',  text: 'text-slate-500',  pill: 'bg-slate-50 text-slate-600 border-slate-200' },
};
```

2. **Card wording** (title case, replaces `VERDICT_TILE_SHORT`):

```ts
const CARD_LABEL: Record<Verdict, string> = {
  on_time: 'On Time',
  late_reported_on_time: 'Late · Reported Ahead',
  late_reported_late: 'Late · Reported After Shift',
  late_no_form: 'Late · No Form',
  absent_reported_on_time: 'Absent · Reported Ahead',
  absent_reported_late: 'Absent · Reported After Shift',
  unexplained_absence: 'Absent · Unexplained',
  pto: 'PTO', permission: 'Permission', holiday: 'Holiday', not_processed: 'Not Run Yet',
};
```

3. **Date without a `Date` object.** Delete the local `fmtDate`. Import
   `fmtDay` from `@/app/lib/fmtDay` and use
   `const [wd, ...rest] = fmtDay(row.date, row.date.slice(0, 4)).split(' '); const md = rest.join(' ');`
   → `wd = 'Mon'`, `md = 'Aug 10'`. `fmtTime` stays exactly as it is.

4. **`DayTile`** renders this (keep the two existing flag icons, absolutely
   positioned top-right / bottom-right, exactly as today):

```tsx
const t = TONE[VERDICT_TONE[row.verdict]];
<div className={`relative w-[150px] shrink-0 bg-white border border-slate-200 border-t-[3px] ${t.stripe} rounded-lg px-2.5 pt-1.5 pb-2 shadow-sm text-[11px] leading-snug`} title={VERDICT_LABEL[row.verdict]}>
  <div className="flex items-baseline gap-1.5 mb-1">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{wd}</span>
    <span className="text-[14px] font-bold text-slate-900">{md}</span>
  </div>
  <div className={`flex items-center gap-1.5 font-semibold mb-1 whitespace-nowrap ${t.text}`}>
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
    {CARD_LABEL[row.verdict]}
  </div>
  {/* time line */}
  {row.entryTime ? (
    <div className="tabular-nums text-slate-900 whitespace-nowrap">
      {fmtTime(row.entryTime)} <span className="text-slate-400">→</span>{' '}
      {row.exitTime ? fmtTime(row.exitTime) : <span className="text-slate-400">no exit</span>}
    </div>
  ) : (
    <div className="text-slate-400">{row.coveredBy ? row.coveredBy.label : 'no punches'}</div>
  )}
  {/* meta row */}
  <div className="flex items-center gap-1.5 mt-1.5 min-h-[18px]">
    {row.minutesLate > 0 && (
      <span className={`rounded-full border px-1.5 py-px text-[10px] font-bold ${t.pill}`}>+{row.minutesLate}m</span>
    )}
    {row.form && (
      <span className="text-slate-500 truncate" title={row.form.onTime ? 'Form sent before the shift' : 'Form sent after the shift'}>
        {row.form.onTime ? '✓' : '⚠'} {row.form.type}
      </span>
    )}
  </div>
  …flag icons unchanged…
</div>
```

5. **Employee header:** after the `{summary.lateDays} late` span add, when
   there is at least one late row,
   `<span className="text-amber-600">avg +{avg}m</span>` where
   `avg = Math.round(lateRows.reduce((s, r) => s + (r.minutesLate ?? 0), 0) / lateRows.length)`
   and `lateRows = rows.filter(r => r.verdict.startsWith('late'))`. Compute it
   inside `EmployeeCard` from its `rows`.

6. Tile grid gap becomes `gap-2`. Remove now-unused imports/constants.

## AttendanceReportTable.tsx

`VERDICT_BADGE`: `late_reported_late` and `absent_reported_late` →
`'bg-orange-100 text-orange-700'`; `absent_reported_on_time` →
`'bg-sky-100 text-sky-700'`. Nothing else in the file.

## Verify

- `/attendance/reports`, Cards: every card is white with a coloured top
  stripe; "MON Aug 10 · Late · Reported Ahead · 9:54 AM → 5:01 PM · +54m · ✓ Tardiness".
  Absences read "no punches"; PTO days show the PTO label; a missing exit
  reads "no exit". Header shows "7 late · avg +16m" style.
- Table: "Late — form sent after shift" and "Absent — reported after shift"
  chips are orange; "Absent — reported ahead" is sky blue. Filter chip
  wording unchanged.
- Both files under 15 KB. `grep -rn "new Date(" src/app/pages/attendance/AttendanceReportStrips.tsx` returns nothing.
- Only the two files changed. Confirm every identifier used is imported.
