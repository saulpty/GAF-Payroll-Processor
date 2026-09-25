# DESIGN.md — GAF Panama HR Hub design rules

Read before building or changing any screen. Condensed from the full design system
(git repo `docs/DESIGN-SYSTEM.md`). Chosen 2026-09-25: **Warm variant, Title Case.**

## Rollout: page by page
Only **redesigned** pages use the Warm tokens below. Do not restyle any other page, do not
change `--primary` / `--secondary`, and never edit `src/components/ui/*`. New shared parts
live in `src/app/components/ds/`. Every file stays under 15 KB.

## Color tokens (use tokens, never raw hex)
| Token | Tailwind | Value | Use |
|---|---|---|---|
| `--warm` | `bg-warm` | #F37021 | Primary action fills, selected-row bar, active tab underline |
| `--warm-ink` | `text-warm-ink` | #08193E | Text/icons **on** orange fills (white on orange fails contrast) |
| `--warm-text` | `text-warm-text` | #C2410C | Orange **text** on white: links, "Undo", sort arrow |
| `--warm-tint` | `bg-warm-tint` | #FFF4EC | Selected table row background |
| `--warm-ring` | `ring-warm-ring` | orange 25% | Focus ring on redesigned inputs |
| frame | existing `--primary` | #1B3A6B navy | Top bar and headings stay navy |
| status | `status-red/yellow/green` `fill`/`ink`/`tint` | Excel colors | **Unchanged.** HR reads them like a spreadsheet |
Never put raw #F37021 as text on white.

## Type (Inter)
Table cells 13px/400 · column headers 12px/600 · labels 13px/500 · helper text 12px ·
page title 22px/700. Numbers use `tabular-nums` and are right-aligned.

## Case
- **Title Case**: page titles, headings, buttons, tabs, nav, column headers, filter chips,
  field labels, dialog titles. Minor words stay lowercase unless first/last: a, an, the,
  and, or, but, of, to, in, on, at, for, by, with. E.g. `Commit 2 to Green`, `Needs an Event`.
- **Sentence case**: helper text, errors, toasts, empty states, tooltips, placeholders.
  E.g. `Pick an event first`, `Not a real time`.
- Data values show as stored. Never ALL CAPS.

## Formats (use the helpers; never hand-format)
| What | Helper | Example |
|---|---|---|
| Date in a table | `fmtDay(ymd, thisYear)` from `lib/fmtDay`; `thisYear = toLocalYMD(new Date()).slice(0, 4)` | `Wed Sep 7` (year only if not this year) |
| Time | `fmtTime(t)` from `lib/fmtTime` | `9AM`, `9:30AM` |
| Shift | `fmtShift(workDays, start, end)` | `Mon–Fri · 9AM–5PM` |
| Minutes | — | `45 min`; over 60: `1h 15m` |
Dates stay `YYYY-MM-DD` strings; never `new Date(str)` for date math.

## Tables
- Header sticky; row height 44px; no zebra striping (it fights the status fills).
- Fixed widths for date (92px), times (84px), minutes (56px), status (64px), discount (86px).
  Names truncate with the full name in `title`. Only notes get the leftover width.
- Every categorical column (status, event, impact) can be sorted **and** filtered.
- Selected row: `bg-warm-tint` plus a 3px inset `--warm` bar on the left.

## Bulk actions
Checkbox column on the left. The bulk bar appears **only when 2 or more rows** are selected,
floating at the bottom centre: `N selected · Set Event · Set Impact · Commit N to Green · Clear`.
Never show it for one row; a single row is edited inline.

## Dropdowns
Use `ds/Combobox` (searchable when more than 7 options). Empty shows `—`; a × clears back to
empty. No "None" / "— pick —" options.

## Required and dependent fields
If B needs A (Impact needs Event), choosing B first: A's border pulses red
(`animate-flash-required`, 2 pulses, 600ms) and shows `Pick an event first` under it.
Required labels carry a red `*`.

## Time inputs
Use `TimeInput`. It accepts 9, 930, 9:30p, 14:30; anything impossible (`55:00 PM`) turns the
box red with `Not a real time` and must block saving that row.

## Saving
- Never reload the whole table after a save; never reset scroll, filters or selection except
  the rows just committed.
- Update saved rows in place (optimistic), then refresh quietly in the background.
- Row states: unsaved (dot), saving (spinner), saved (green `Saved` check + `animate-saved-fade`
  ~1.2s), error (red, stays until fixed).
- Toast bottom-left, non-blocking: `Saved · Undo`, auto-dismiss 5s. Errors stay until closed.

## Counts and filters
Red/yellow/"needs an event" counts always reflect the **current** filters, from first load.
Counts are chips; clicking one filters the table.

## Accessibility
Real `<button>`s and `<label>`s; visible focus ring; icon-only buttons get `aria-label`;
text contrast ≥ 4.5:1; honour `prefers-reduced-motion`.
