---
version: 1.0
name: GAF Panama HR Hub — Design System
description: A light, data-dense HR/payroll system for staff reviewing exception tables all day. Two accent variants (Warm / Classic) share every rule except brand color.
colors:
  shared:
    background: "#F7F9FC"
    surface: "#FFFFFF"
    foreground: "#0F172A"
    muted-foreground: "#64748B"
    border: "#E2E8F0"
    input-border: "#CBD5E1"
    success: "#16A34A"
    warning: "#B45309"
    error: "#DC2626"
    info: "#2563EB"
    status-green-fill: "#C6EFCE"
    status-green-ink: "#006100"
    status-green-tint: "#EDF7EE"
    status-yellow-fill: "#FFEB9C"
    status-yellow-ink: "#9C6500"
    status-yellow-tint: "#FFFBEB"
    status-red-fill: "#FFC7CE"
    status-red-ink: "#9C0006"
    status-red-tint: "#FFF0F0"
  variant-warm:
    primary: "#F37021"
    primary-text-safe: "#C2410C"
    primary-foreground: "#08193E"
    frame: "#1B3A6B"
    frame-foreground: "#FFFFFF"
    secondary: "#1B3A6B"
  variant-classic:
    primary: "#1B3A6B"
    primary-foreground: "#FFFFFF"
    secondary: "#2AA876"
    secondary-foreground: "#FFFFFF"
    frame: "#1B3A6B"
    frame-foreground: "#FFFFFF"
typography:
  font-family: Inter
  table-cell:
    fontSize: 13px
    lineHeight: 18px
    fontWeight: 400
  table-header:
    fontSize: 12px
    lineHeight: 16px
    fontWeight: 600
    letterSpacing: 0.02em
  body:
    fontSize: 14px
    lineHeight: 20px
    fontWeight: 400
  label:
    fontSize: 13px
    lineHeight: 16px
    fontWeight: 500
  heading-sm:
    fontSize: 16px
    lineHeight: 22px
    fontWeight: 600
  heading-md:
    fontSize: 20px
    lineHeight: 26px
    fontWeight: 600
  heading-lg:
    fontSize: 24px
    lineHeight: 30px
    fontWeight: 700
  micro:
    fontSize: 11px
    lineHeight: 14px
    fontWeight: 500
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 8px
  pill: 9999px
spacing:
  base: 4px
  scale: [4, 8, 12, 16, 20, 24, 32, 40, 48]
components:
  table-row-compact:
    height: "32px"
    paddingX: "8px"
  table-row-default:
    height: "40px"
    paddingX: "12px"
  chip:
    rounded: "{rounded.pill}"
    paddingX: "10px"
    paddingY: "3px"
    fontSize: "12px"
  bulk-bar:
    height: "44px"
    background: "surface"
    border: "1px solid {colors.shared.border}"
---

## Overview

This app is a spreadsheet, not a marketing site. HR staff spend hours a day scanning dense tables of payroll exceptions — Action Required, Payroll Master — and they read status color the way they read Excel conditional formatting: instantly, without thinking about it. Every rule below optimizes for that: high information density, unambiguous state, fast scanning, and zero surprises when a row is edited or saved. Warmth comes from type, spacing, and one accent color used sparingly — never from decoration that competes with the data.

Light mode only. Desktop-first (this is a back-office tool used on a workstation), but never so cramped that a 13px number is unreadable.

Two accent variants are defined below as token sets, "Warm" and "Classic." They differ only in `primary`/`secondary`/frame color usage. Everything else — spacing, type, tables, status colors, motion — is identical. The app owner will pick one by eye; until then, build every new screen so it only reads from the `--primary` / `--secondary` tokens, never a hardcoded hex, so switching variants is a one-line change.

## Colors

**Shared neutrals** (both variants):
- `background` `#F7F9FC` — page canvas, slightly cooler than white so white cards lift off it.
- `surface` `#FFFFFF` — cards, table body, panels.
- `foreground` `#0F172A` — primary text.
- `muted-foreground` `#64748B` — secondary text, helper text, placeholder.
- `border` `#E2E8F0` — hairlines, table borders, dividers.
- `input-border` `#CBD5E1` — form control borders (slightly darker than table hairlines so inputs read as interactive).

**Semantic status** (shared, both variants — these are UI chrome states, distinct from the Excel-style fills below):
- `success` `#16A34A`, `warning` `#B45309`, `error` `#DC2626`, `info` `#2563EB`.
- Each has a `-bg` tint at 10% opacity over `surface` for banners and inline messages (e.g. `error-bg` = `#DC2626` at 8%).

**Excel-style status fills — kept exactly, do not touch.** These are how HR reads a payroll exception at a glance. They come from `src/index.css` and must not be redefined or renamed:
- Green: fill `#C6EFCE`, ink `#006100`, tint `#EDF7EE`.
- Yellow: fill `#FFEB9C`, ink `#9C6500`, tint `#FFFBEB`.
- Red: fill `#FFC7CE`, ink `#9C0006`, tint `#FFF0F0`.
- Use `-fill` for a solid cell/chip background, `-ink` for text on that fill, `-tint` for a whole-row wash (e.g. the row background when a day is flagged, subtler than the fill).

**Variant "Warm"** — orange primary action color, GAF navy frame:
- `primary` `#F37021` (GAF orange) — button fills, active tab underline, selected-row accent bar. **Never** as text on white (links use `primary-text-safe`).
- `primary-text-safe` `#C2410C` — **use this, not `#F37021`, for any orange text at 13–14px on white.** See Accessibility below; raw `#F37021` fails AA for normal text.
- `primary-foreground` `#08193E` (near-ink navy) — text/icons on a solid orange button. **Not white:** white on `#F37021` is the same ~2.9:1 pair and fails AA. Ink navy on orange is ~5.8:1 (the AlayaCare reference does the same).
- `secondary` `#1B3A6B` (GAF navy) — secondary buttons, links inside the top bar.
- `frame` `#1B3A6B` — top bar, page headings, nav background.
- `frame-foreground` `#FFFFFF`.

**Variant "Classic"** — GAF navy primary, teal secondary (the current app palette):
- `primary` `#1B3A6B`, `primary-foreground` `#FFFFFF` — buttons, links, active states.
- `secondary` `#2AA876`, `secondary-foreground` `#FFFFFF` — secondary buttons, positive accents.
- `frame` `#1B3A6B`, `frame-foreground` `#FFFFFF` — same as primary; navy carries both roles.

Both variants keep the same neutrals and the same Excel status fills — a screenshot of a table looks identical in either variant. Only buttons, links, the top bar, and focus-adjacent accents change.

## Typography

Inter, the font already loaded (`--font-sans` in `src/index.css`). Dense UI needs a smaller scale than a marketing site — nothing in a table is larger than 14px.

| Token | Size / Line height | Weight | Use |
|---|---|---|---|
| `table-cell` | 13px / 18px | 400 | Every data-table cell body. |
| `table-header` | 12px / 16px | 600, +0.02em tracking | Column headers, uppercase optional but not required. |
| `micro` | 11px / 14px | 500 | Row timestamps, chip counts, footnotes. |
| `label` | 13px / 16px | 500 | Form field labels, filter labels. |
| `body` | 14px / 20px | 400 | Paragraph text, dialog copy, helper text. |
| `heading-sm` | 16px / 22px | 600 | Card titles, section headers. |
| `heading-md` | 20px / 26px | 600 | Page titles. |
| `heading-lg` | 24px / 30px | 700 | Rare — top-level page header only, one per page. |

Numbers in tables (minutes, hours, money) use tabular figures (`font-variant-numeric: tabular-nums`) so columns of digits align. Never justify or letter-space body text for effect — this isn't a marketing page.

## Layout

4px base spacing unit. Use the scale `[4, 8, 12, 16, 20, 24, 32, 40, 48]` — never an arbitrary value like `13px` or `22px`. Page content sits in a fluid container with 24px side padding on desktop; dense tables may run full-width inside a card. Card interior padding is 16px (dense) or 20px (normal forms). Gaps between stacked page sections: 24px. Gaps between a label and its input: 4px. Gaps between form fields in a row: 16px.

## Elevation & Depth

Flat and quiet. Cards use a 1px `border` plus the existing `--shadow-card` token (`0 1px 2px rgb(15 23 42 / .04), 0 1px 3px rgb(15 23 42 / .06)`) — do not invent new shadow values, the scale in `src/tailwind.config.js` (`2xs` through `2xl`, plus `card`) already covers every case from a resting card to a modal. Dialogs use `shadow-xl`. Dropdown menus and popovers use `shadow-md`. Never stack more than one shadow tier deeper than the element actually floats — a table row is not elevated, ever, even on hover.

## Shapes

Small, consistent radii — this is a workstation tool, not a consumer app, so nothing should feel bubbly. `sm` 4px for chips and small controls, `md` 6px for buttons/inputs/cards (this matches the existing `--radius: 0.5rem` scale in `tailwind.config.js`), `lg` 8px for dialogs and large cards, `pill` (9999px) reserved for status chips and the bulk-action counter badge only — never for buttons.

## Components

Reuse what exists in `src/components/ui/` (badge, button, card, dialog, input, label, select, textarea) as-is — do not restyle them. New shared pieces needed for this system (searchable combobox, data table shell, bulk-action bar, inline-edit cell, row-state indicator, dependent-field wrapper, toast/flag) are net-new components and belong in `src/app/components/ds/`, each under 15 KB, each doing one job.

- **Button** — primary (solid `primary` bg), secondary (outline, `border` + `foreground` text), destructive (solid `error`), ghost (no border, `muted-foreground` text, `background` hover). Height 32px in toolbars, 36px in forms/dialogs. Never a pill.
- **Chip / Badge** — pill-shaped, 12px text, used for status labels and the "N selected" bulk counter. Uses the Excel-style fills for payroll status, semantic colors for everything else (e.g. a blue "New" chip uses `info`).
- **Input / Select / Textarea** — 36px height, 1px `input-border`, `md` radius, `focus:ring-2` in `primary` at 30% opacity (matches the existing `--ring` token). Error state swaps border to `error` and shows inline helper text below in `error` at 12px.

## Data Tables

Rules below borrow from Carbon's data-table guidance (density options, header/toolbar behavior — the live page could not be fetched during this write-up; applied from well-known Carbon conventions and noted below) and Polaris's index-table pattern for selection and bulk actions.

- **Row height**: two densities only. **Compact** (default for Action Required / Payroll Master, where rows number in the hundreds): 32px. **Default** (used where rows are fewer and each carries more read weight, e.g. an audit list): 40px. Never a third size — pick one per table and keep it.
- **Header**: sticky to the top of the scroll container (`position: sticky; top: 0`) with a `surface` background and a 1px bottom `border` so it never blends into scrolled content. Header text is `table-header` token, left-aligned except numeric columns (see below).
- **Column widths**: fixed, not auto — a table where columns reflow as data loads is disorienting for someone scanning 200 rows.
  - Date columns: 96px fixed.
  - Time columns: 80px fixed.
  - Status column: 88px fixed, centered.
  - Minutes/duration columns: 72px fixed, right-aligned.
  - Name columns: min 140px, max 220px, `truncate` with `title="<full name>"` so hover shows the untruncated value — never wrap a name to two lines.
  - Everything else: flexible with a sane min-width (100px) so a resize never collapses a column to unreadable.
- **Numeric alignment**: every numeric column (minutes, hours, money, counts) is right-aligned with tabular figures. Text columns are left-aligned. Status/badge columns are centered.
- **Sorting**: every column with a small, bounded set of values (status, employee type, group, work group) and every date/number column is sortable via a click on the header; show a small chevron indicating direction, only on the active sort column (don't clutter every header with a neutral sort icon — Carbon and Polaris both keep unsorted headers clean and only add the affordance on hover/focus).
- **Filtering**: every categorical column (status, group, department, exception type) gets a filter — either a header-adjacent dropdown or a filter bar above the table (see Page Layout below). Text/name columns get a free-text search box instead of a per-column filter.
- **Row hover**: background shifts to `muted` (`#F1F5F9`) on hover — never a shadow or scale change, that reads as a card in a data table and is distracting at high row counts.
- **Selected row**: background `primary` at 8% opacity, plus a 2px left border in `primary` — this must stay visible under the Excel-style status tint, so it's drawn as an overlay, not a replacement of the row's status background.
- **Zebra striping**: **no.** With Excel-style status fills already coloring rows (green/yellow/red), an alternating stripe fights the status color and makes a clean row look "shaded" when it isn't. Rely on the 1px row border instead (Carbon's convention for tables that already carry strong per-row semantic color).
- **Empty state**: centered message inside the table body, not a blank white box — icon + one line naming what's missing (e.g. "No exceptions for this range") + the currently active filter description, so a zero-row result reads as "filter working, nothing matched," not "broken." (Lesson from `docs/LESSONS.md` #3: a 0-row result must always be honest about *why* it's zero.)
- **Loading state**: skeleton rows (3–5 gray pulsing bars matching the real row height for that table's density) — never a full-table spinner that replaces the header, since that loses the user's place.

## Bulk Actions

Following Polaris's resource-index pattern:

- A checkbox column is the first column of any table that supports bulk actions. Header checkbox selects/deselects all visible (filtered) rows.
- The bulk-action bar appears **only when 2 or more rows are selected.** A single selected row shows its actions inline on that row (or in a right-side panel) — never in a floating bar. This avoids an ambiguous bar that appears for a single click and makes people wonder if "bulk" is about to happen accidentally.
- The bar itself: fixed position just above the table body (replaces the filter bar's space, doesn't cover rows), `surface` background, 1px `border`, 44px tall. Left side: "**N selected**" in `label` weight. Middle: action buttons (approve, reject, export — whatever the page supports). Right: a "Clear" ghost button that deselects everything.
- Selecting a 3rd, 4th, etc. row just updates the count live — the bar never remounts or flashes.

## Dropdowns

- Any list with **more than 7 items** (employee names, departments, exception types once the list grows) is a searchable combobox, not a plain `<select>` — typing filters the list. Fewer than 7 items can stay a plain select.
- Every optional dropdown has an explicit clearable state: placeholder is an em dash `—` (not "None" — "None" reads as a value, `—` reads as absence), and once a value is picked, a small `×` appears at the right edge of the control to clear it back to `—`. Never offer an ambiguous literal "None" option in the list itself.
- Keyboard: `↓`/`↑` moves the highlighted option, `Enter` selects it, `Esc` closes without changing the value, typing filters. Focus ring uses the standard `--ring` token (already global in `src/index.css`), don't override it per-component.

## Dependent Fields

When field B depends on field A being filled first (e.g. "Impact" requires "Event" to be chosen first):

- If the user interacts with B before A has a value, **don't just block silently.** Flash A's border in `error` for two pulses of ~300ms each (≈600ms total, matching a standard attention-flash duration), and show inline helper text under A: "Pick an event first" in `error` at 12px, which then fades once A is filled.
- Required fields are marked with a small red asterisk immediately after the label, not by border color alone (border-only cues fail for colorblind users and don't scan well in a dense form).
- Once A has a value, B enables normally with no residual styling.

## Inputs

- **Time input**: accepts hour 1–12, minute 00–59, and AM/PM (or a 24h `HH:MM` variant where the page is explicitly 24h — pick one per page, never mix). Reject any out-of-range value inline as the user leaves the field (e.g. "55:00 PM" shows "Enter a valid time" in `error` under the field) — do not silently clamp or reformat a bad value into something that looks accepted.
- **Date input**: `YYYY-MM-DD` under the hood always (per the timezone invariant in `src/AGENTS.md` — dates are strings, compared as strings, never `new Date(str)` for math), but the visible control can use a calendar picker or a masked text field showing the display format from the Formats section below. Never let the visible format and the stored format silently diverge in a way that lets a user type an ambiguous date.

## Formats

- **Dates in tables**: `Wed 7 Sep` — weekday abbreviation, day (no leading zero), month abbreviation. Add the year only when it isn't the current year: `Wed 7 Sep 2025`.
- **Times**: `9AM` when on the hour, `9:30AM` otherwise — no leading zero, no space before AM/PM, uppercase AM/PM.
- **Schedules**: `Mon–Fri · 9AM–5PM` — en dash for day ranges, middle dot separator, en dash for time ranges.
- **Minutes**: under 60, show as `45 min`. 60 and over, show as hours+minutes: `1h 15m` (never `75 min` once it crosses an hour — always convert).
- **Money** (if/when it appears): `$1,234.56`, always two decimals, comma thousands separator, no currency-code suffix since this app is Panama-only USD.

## Saving

No full-page reload or flash after a save — this is the #1 thing that makes a dense table feel untrustworthy.

- **Optimistic update**: the row updates in place immediately on submit, before the server confirms.
- **Per-row state**, shown as a small indicator at the row's leading edge: `unsaved` (dot, `muted-foreground`), `saving` (small spinner, `primary`), `saved` (checkmark in `success`, fades out over ~1.2s), `error` (icon in `error`, stays until the user dismisses it — never auto-hides, since a silent failed save is exactly the kind of bug that has bitten this app before per `docs/LESSONS.md`).
- **Toast**: non-blocking, bottom-left corner, text "Saved · Undo". Auto-dismisses after 5 seconds. An error toast (or the row error indicator) does not auto-dismiss — the user must acknowledge it.
- Scroll position and active filters are preserved across a save — the table must not reset to the top or clear filters just because one row changed.

## Summary Counts / Filters

The red/yellow (and green, where shown) summary chips at the top of a page always reflect the **currently active filter**, computed fresh from first load, not a stale global count. Each chip is clickable and applies/toggles that status as the active table filter — clicking the red chip filters the table to red rows, clicking it again clears that filter. This keeps the chips and the table always in agreement, which matters a lot given the app's history of counts and table contents silently disagreeing.

## Page Layout (Data Pages)

Top to bottom, all inside a sticky-header shell:
1. **Page header** — title (`heading-md`), plus any page-level actions top-right (e.g. "Export").
2. **Filter bar** — search box, per-column filters/dropdowns, date-range picker where relevant. Sticky just below the page header when the table is tall enough to scroll independently.
3. **Summary chips** — red/yellow/green counts as described above, directly under the filter bar.
4. **Bulk bar** — only rendered when 2+ rows are selected, replaces the chip row's vertical space without shifting the table.
5. **Table** — sticky header row, fills remaining viewport height, its own scroll container so the filter bar and chips never scroll away.

## Accessibility

- **Contrast (WCAG AA)**: body/table text at 13–14px needs ≥4.5:1 against its background. `foreground` (`#0F172A`) on `background`/`surface` (`#F7F9FC`/`#FFFFFF`) comfortably passes (>15:1). The Excel-style status inks (`#006100`, `#9C6500`, `#9C0006`) on their matching tints all pass AA comfortably (each is a deep, low-luminance color against a very light tint).
- **Orange contrast problem, found and fixed here**: raw `#F37021` (Warm variant's `primary`) on white is **~2.9:1** — it fails AA for normal text (needs 4.5:1) and even fails for large text (needs 3:1). White-on-orange is the **same pair** and fails just the same, so solid orange buttons carry **ink navy `#08193E` text** (~5.8:1, passes). Raw orange is fine for fills, underlines, accent bars and icons next to a text label. But **any orange text on a white/light background must use `primary-text-safe` (`#C2410C`) instead**, which measures ~5.1:1 and passes AA for normal text. This token is defined for exactly that reason — links, active-tab text, and small orange labels use it, not the raw brand orange.
- **Focus visible**: every interactive element keeps the existing global `:focus-visible` outline (2px solid `--primary`, 2px offset) already defined in `src/index.css` — do not suppress it, do not replace it with a box-shadow-only ring on new components.
- **Keyboard nav**: full tab order through filters → table (arrow keys move row focus where a table supports keyboard row selection) → bulk bar → pagination. Every dropdown, combobox, and dialog is operable without a mouse (see Dropdowns above).

## How UI Bakery's AI Must Use This Doc

1. **Always reference tokens, never raw hex.** Use `var(--primary)`, `text-status-green-ink`, etc. — never hardcode `#F37021` or `#1B3A6B` inline. This is what makes the Warm/Classic variant switch a one-line change instead of a grep-and-replace.
2. **New shared UI parts go in `src/app/components/ds/`.** Never modify anything in `src/components/ui/` (badge, button, card, dialog, input, label, select, textarea) — those are the existing shadcn primitives and are off-limits.
3. **Keep files under 15 KB.** Split a component rather than let one grow, per the project's existing hard constraint.
4. **One component, one job** — a data-table shell, a bulk-bar, an inline-edit cell, a dependent-field wrapper, and a toast/flag are five separate files, not one mega-component.
5. **Never touch `src/` by hand outside the UIB change loop** — this doc informs prompts sent to UIB's AI panel; it does not authorize a direct edit to `src/`.
6. **When a rule here conflicts with an existing page's current behavior**, treat this doc as the target state and flag the gap in the prompt, rather than silently changing unrelated pages.

## Credits

- **IBM Carbon** (data-table usage patterns): https://carbondesignsystem.com/components/data-table/usage/ — row density options, sticky header, hover state, no-zebra-with-strong-row-color convention, sort-affordance-on-active-column-only. *Note: the live page could not be fetched while writing this doc (returned empty/truncated content both attempts); the rules above reflect Carbon's well-documented, widely-cited conventions rather than a fresh read of the page.*
- **Shopify Polaris** (index table / resource index layout): intended sources https://polaris-react.shopify.com/components/tables/index-table and .../patterns/resource-index-layout — bulk-actions-only-at-2+-selected, filter bar above table, checkbox-column selection, empty-state pattern. *Note: both URLs now redirect (Polaris moved to shopify.dev) and could not be fetched during this write-up; applied from well-known Polaris conventions.*
- **Atlassian Design System** (inline edit, flags, tokens): https://atlassian.design/components/inline-edit, https://atlassian.design/components/flag, https://atlassian.design/foundations/tokens/design-tokens — per-row save-state pattern, non-blocking toast with Undo and persistent error state, and the Foundation+Property+Modifier token-naming convention this doc's tokens loosely follow. *The tokens page fetched successfully; inline-edit and flag pages returned empty content and are applied from well-known Atlassian conventions.*
- **shadcn/ui**: base primitive components already in `src/components/ui/` (button, dialog, select, etc.) — this doc extends them, does not replace them.
- **Tremor**: informs the dense numeric-table and stat-chip conventions (right-aligned tabular numbers, compact chip counts) used above, as a common reference for data-heavy dashboard UI.

## Do's and Don'ts

- Do reference every color, radius, spacing, and shadow value as a token — never a raw hex or pixel value typed inline.
- Do keep tables flat, bordered, and zebra-free — let the Excel-style status fills carry the color.
- Do show the bulk bar only at 2+ selections, and keep single-row actions inline.
- Do use `primary-text-safe` for any orange text on light backgrounds in the Warm variant.
- Do preserve scroll position and filters across a save; never reload the page to reflect a change.
- Do mark required fields with an asterisk, not color alone.
- Don't invent a third row density, a new shadow tier, or a new border radius outside the scale above.
- Don't use "None" as a dropdown option when the intent is "no value" — use the `—` placeholder plus a clear button.
- Don't let a table's 0-row state look like an error or a loading state — always name the active filter.
- Don't auto-dismiss an error toast or a row's error indicator.
- Don't touch `src/components/ui/` or hand-edit `src/` outside the UIB change loop.
