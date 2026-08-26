# The Attendance donuts must draw on first load

Two files:

- `src/app/pages/attendance/AttendanceDonuts.tsx`
- `src/app/pages/attendance/AttendancePanel.tsx`

## The defect

On `/attendance`, the three donut charts sometimes render an **empty SVG** on
first load. Verified in the DOM, not just by eye: each `svg.recharts-surface`
measured 505×170 and contained **zero `<path>` elements**. The centre percentage
and the legend still draw, so the card looks deliberate rather than broken.
Touching any filter makes all three appear correctly. It is intermittent, which
points at a race during the first render rather than an unconditional failure.

## The change

Recharts' `Pie` animates from zero on mount. Combined with `paddingAngle`, that
animation is the likely source of the empty first paint, and the animation is
not wanted here anyway — the design brief for this app says transitions are for
hover and colour only, with no layout animation.

Set **`isAnimationActive={false}`** on every `Pie` in both files:

- `AttendanceDonuts.tsx` — the single `Pie` inside `DonutChart`, which all three
  donuts share.
- `AttendancePanel.tsx` — both `Pie` elements (the status breakdown and the
  reporting breakdown).

Change nothing else about them: keep `data`, `cx`, `cy`, `innerRadius`,
`outerRadius`, `dataKey`, `paddingAngle`, `strokeWidth`, and every `Cell`
exactly as they are.

While in `DonutChart`, also add `debounce={50}` to its `ResponsiveContainer`.
That gives the container a moment to settle before it measures, which guards the
same race from the other side. Do not change its `width` or `height`.

## Do not touch

- No other file. Not the KPI tiles, not `attendanceStats.ts`, not `index.css`,
  not `Attendance.tsx`.
- Do not change any colour — those were just brought onto the brand tokens and
  are correct.
- Do not change any value, label, legend entry or layout.
- Do not convert the charts to a different library or component.

## Acceptance criteria

- Load `/attendance` fresh, without touching any filter. **All three donut rings
  are drawn.**
- The 60-day figures are unchanged: `DAYS TRACKED` 1428, `ON-TIME RATE` 63.5%,
  `LATE — UNREPORTED` 245.
- The employee side panel's two pies still render when a row is opened.
- The donuts still show their centre figure and legend.
- No console errors.

Then confirm every identifier used in each file is imported.
