# Dashboard: one lead number, one alert, and chart colours from the tokens

One file only: **`src/app/pages/SummaryDashboard.tsx`**.

Six KPI tiles currently shout equally — six different colours, six bold numbers,
six tinted icon squares, and no indication which one matters. Saul approved a
version with one lead figure, one alert, and the rest quiet.

## 1. Align the chart colours to the tokens

The local `C` object at line 59 duplicates colours that now exist as
`--chart-1` … `--chart-6` in `src/index.css`. Recharts needs real colour values,
not classes, so keep `C` as literals — but make them match the tokens exactly and
say where the source of truth is.

`amber` is the only one that has drifted: it is `#F59E0B`, while `--chart-3` is
`#FBBF24`. Change it to `#FBBF24`.

Leave `navy`, `teal`, `red`, `slate`, `indigo` as they are — they already match
`--chart-1`, `-2`, `-4`, `-5`, `-6` exactly. Leave `green` and `yellow` alone.

Add a comment above `C`:

```ts
// Mirrors --chart-1..6 in src/index.css, which is the source of truth.
// Recharts needs literal values, so these are kept in sync by hand.
```

## 2. Give `KpiCard` a tone

Add a `tone` prop: `'lead' | 'alert' | 'plain'`, defaulting to `'plain'`. Keep
every existing prop and the existing `Card` / `CardContent` structure.

- **`lead`** — the headline. Keep the coloured value. Add a navy left rail on the
  card: `border-primary` plus `shadow-[inset_3px_0_0_var(--primary)]`, or an
  equivalent using the existing tokens. The icon square keeps its tint.
- **`alert`** — needs action. Value stays red. Icon square keeps its tint.
- **`plain`** — everything else. The value renders in `text-foreground` rather
  than its own colour, and the icon square drops its coloured tint for
  `bg-muted` with `text-muted-foreground`. This is the change that stops all six
  competing.

In all three, the value gets `tabular-nums` and `tracking-tight` so the figures
line up and read as data. Keep `text-2xl font-bold`.

Keep the `color` prop and keep using it for `lead` and `alert`; `plain` simply
ignores it.

## 3. Update the six call sites (lines ~224-229)

Assign tones and give every tile a caption saying what the number counts. The
caption is the `sub` prop, which already exists and already renders.

| Tile | tone | sub |
|---|---|---|
| Employees | plain | `in this period` |
| Discount Hours | **lead** | `total unpaid time` (unchanged) |
| Absences | plain | `days marked absent` |
| Late Days | plain | `arrivals after grace` |
| RED Entries | **alert** | `need resolution` (unchanged) |
| PTO / Permits | plain | `approved days` |

Discount Hours is the lead because it is the number Saul actually checks. RED
Entries is the alert because it is the one that requires someone to do something.

## Do not touch

- No other file. Not `index.css`, not `tailwind.config.js`, not a shared
  component, not an action.
- Do not change any query, any total, any sort, any table, or the three charts'
  data or layout. **No number on this page may change.**
- Do not change the page's heading, the period filter, or the employee table.
- Do not reorder the six tiles.

## Acceptance criteria

- The six figures are **numerically identical** to before. This is a styling
  change only.
- Discount Hours carries a navy left rail; RED Entries' value is red; the other
  four render their value in the normal foreground colour with a muted icon.
- Every tile has a caption line under its number.
- The three charts still render with the same shapes; only the amber series
  shifts very slightly.
- Page loads with no console errors.

Then confirm every identifier used in the file is imported.
