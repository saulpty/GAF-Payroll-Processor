# Keyboard users can't select rows, and nine icon buttons have no name

Three files. **`ActionRequired.tsx` and `AdminLookups.tsx` are protected files;
Saul asked for the accessibility work directly.** Everything below is additive —
no handler, query, style or layout changes.

## 1. Row selection is unreachable by keyboard — `src/app/pages/ActionRequired.tsx`

Line ~471, the frozen Employee cell:

```tsx
<span onClick={e => toggleRow(row.id, rowIndex, e.shiftKey)} className="cursor-pointer hover:text-blue-700 transition-colors">{row.employee_name}</span>
```

A `<span>` with a click handler is invisible to the keyboard: it cannot be
focused, and Enter or Space do nothing. **Selecting rows is the primary action on
this page**, and it is mouse-only.

Keep the `<span>` and every existing class — do not convert it to a `<button>`,
which would bring its own default styling into a table cell. Add four things:

- `role="button"`
- `tabIndex={0}`
- `aria-pressed={selected.has(row.id)}` so assistive tech announces whether the
  row is selected
- an `onKeyDown` handler that responds to Enter and Space, calls
  `toggleRow(row.id, rowIndex, e.shiftKey)` — passing `e.shiftKey` so
  shift-range-select still works from the keyboard — and calls
  `e.preventDefault()` so Space does not scroll the page.

The existing `onClick` stays exactly as it is.

## 2. The employee panel's close button has no name — `src/app/pages/attendance/AttendancePanel.tsx`

Line ~181: an icon-only button containing only `<X />`. A screen reader announces
it as "button" with no indication of what it does.

Add `aria-label="Close employee panel"`. Change nothing else.

## 3. Seven icon-only buttons in `src/app/pages/admin/AdminLookups.tsx`

All announce as bare "button". Add an `aria-label` to each and change nothing
else — not the class, the handler, the icon, or the disabled state:

| Line | Icon | `aria-label` |
|---|---|---|
| ~120 | `Check` | `Save` |
| ~124 | `X` | `Cancel` |
| ~131 | `Pencil` | `Edit` |
| ~266 | `Check` | `Save rule` |
| ~270 | `X` | `Cancel edit` |
| ~301 | `Pencil` | `Edit rule` |
| ~305 | `Trash2` | `Delete rule` |

Leave the category-toggle button at ~182 alone; it already contains visible text.

## Do not touch

- **No other file.**
- Do not change `toggleRow`, `setEditField`, the selection state, the sort, any
  query, any column width or header label.
- Do not add `aria-label` to a button that already has visible text — it would
  override what a screen reader reads.
- Do not convert any `<span>` to a `<button>` or restructure any JSX.
- Do not change the styling of anything.

## Acceptance criteria

- On Action Required with `Q2-Aug-2026`, **pressing Tab reaches an employee name
  and it shows the navy focus ring.** Pressing Enter or Space selects that row —
  the toolbar count goes to "1 row selected". Pressing it again deselects.
- Shift-selecting a range still works with the mouse exactly as before.
- The employee panel on Attendance still opens and its close button still closes
  it.
- Admin → Rules & Config still saves, cancels, edits and deletes exactly as
  before.
- No console errors, and no visual change anywhere.

Then confirm every identifier used in each file is imported.
