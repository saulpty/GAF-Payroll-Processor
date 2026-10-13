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

## Phone

Everything above still holds on a phone; this section adds what a small touch screen needs. The
app is still a spreadsheet: on a phone it is a spreadsheet one column wide, not a set of cards.

**Two switches, never mixed up.**
- *Phone-sized screen* (layout): the `phone` Tailwind screen and `useIsPhone()`, one shared query
  (`(max-width: 767px), (max-height: 500px) and (pointer: coarse)`). Styling differences use
  `phone:` classes; a different structure uses the hook so only one layout is rendered.
- *Touch screen* (comfort, any width): `@media (pointer: coarse)` in `src/index.css`.
  A desktop with a mouse matches neither and must not change.

**Frame.** Top bar 48 · one 44 px row for tabs or active-filter chips plus the Filters button ·
page · section bar 56. Nothing in the frame is `position: fixed`. Page headers scroll with the page.
Section order and names are the same as on the computer.

**Touch.** Anything tappable has a hit area of at least 44 × 44 px (the visible shape may be
smaller). Text boxes are 16 px on touch screens. Nothing depends on hover: whatever a `title` says
is written out where the person taps. No swipe gestures.

**Type on a phone.** Name / row title 14 px semibold. Row facts 13 px. Labels and pills 12 px.
Nothing below 12 px. Numbers tabular. The one headline number on a row (PTO Available) 20 px bold.

**Rows, not cards (`MobileRow`).** Full width, flat, separated by a 1 px `border` hairline; no
gaps, shadows or rounded boxes between rows; 12 px vertical and 16 px side padding; about 60 px
tall. Line 1: name (wraps to two lines, never "…") and, pinned right, one status pill. Line 2: up
to three facts in `muted-foreground`. A flagged row gets the matching `-tint` wash, as on desktop.
Dimmed rows (day off, inactive) use the muted text colour, never opacity. A row that opens
something is a real button with a pressed state.

**Opening detail.** Down-chevron: opens in place, reading only. Right-chevron: opens a sheet,
for long detail or anything with buttons. At most two layers over a page (a sheet, then one dialog).

**Sheets (`MobileSheet`).** Built on the existing dialog. Full width, top corners `lg` (8 px),
title bar stays while the body scrolls, close button top right. Dialogs on a phone: 16 px side
margin, never taller than the screen, scroll inside, one-column forms, buttons full width.

**Colour.** Section names and active labels on white use the section's `ink` colour, never its
`accent` (Contracts accent on white is 3.2:1). Only truly destructive actions are red (Delete);
Close Case is an ordinary button.

**Sliding lines.** Tabs, filter chips and count strips that do not fit sit on one line that slides
sideways, with a fade on the edge where more is hidden. They never wrap into a block.

**States.** Every phone list has grey placeholder rows while loading, a nothing-found line that
names the active filter, and the error message with a full-width Retry.

**Payroll and Admin** are not redesigned for phones: they keep the computer layout inside
`DesktopCanvas` and slide.
