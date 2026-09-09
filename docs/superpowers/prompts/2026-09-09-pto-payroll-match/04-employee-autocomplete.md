# 04 — Employee search suggestions in the filter bar

Tim asked for name suggestions while typing in the Employee box. The box lives
in the global filter bar, so every page that shows it (PTO, Attendance,
Payroll Master, Contracts, Disciplinary, Summary, Action Required) gets it.

## Files you may change

- `src/app/components/EmployeeSearchInput.tsx` — **new**
- `src/app/FilterBar.tsx` — replace the `<input type="text">` at the
  `cfg.employee` block with the new component; nothing else in the file

**No other file.** `src/components/ui/*` is read-only — do not add a
Command/Combobox/Popover primitive there. No new npm dependency. Every file
under 15 KB. No `toISOString()`. `useLoadAction` params stay flat.

## Behaviour — the same contract every consumer already relies on

Every page filters by **case-insensitive substring of the display name**
(`PtoTable.tsx`, `Attendance.tsx`, `PayrollMaster.tsx` all do
`name.toLowerCase().includes(employee.toLowerCase())`). The component must
therefore keep `employee` a plain string:

- Typing writes the raw text through `onChange` exactly as the input does today
  (so partial text still filters as before).
- Picking a suggestion writes that employee's **exact display name**.

## `EmployeeSearchInput.tsx`

```ts
interface Props {
  value: string;
  onChange: (v: string) => void;
  options: { name: string; role?: string | null; manager?: string | null }[];
  placeholder?: string;
  className?: string;   // applied to the <input>, FilterBar passes its inputCls
}
```

- Wrapper `div.relative`. The `<input type="text">` is controlled by `value`.
- Suggestions open when the input is focused **and** `value.trim()` is
  non-empty; they close on blur, Escape, or pick. Match =
  `name.toLowerCase().includes(value.trim().toLowerCase())`, sorted by name,
  max 8. If the only match equals `value` exactly, show nothing.
- List: `ul.absolute.left-0.top-full.mt-1.w-64.max-h-72.overflow-auto.rounded-lg
  .border.border-slate-200.bg-white.shadow-lg.z-50.py-1` (FilterBar is `z-30`,
  table headers are sticky — the list must sit above both). Each `li` is
  `px-3 py-1.5 text-[13px] cursor-pointer`: the name in `text-slate-800`, then
  `role · manager` in `text-[11px] text-slate-400` (omit empty parts). The
  active row has `bg-slate-100`.
- Keyboard: ArrowDown / ArrowUp move the active row (wrapping), Enter picks
  the active row (or the first when none is active) and closes, Escape closes
  without changing the value. Give the list `onMouseDown={e => e.preventDefault()}`
  so a click is not lost to the input's blur.
- Accessibility: input `role="combobox" aria-expanded aria-autocomplete="list"
  aria-controls`, list `role="listbox"`, items `role="option" aria-selected`.
- No dependency on any page; no data loading inside — `options` come in.

## `FilterBar.tsx`

```tsx
<EmployeeSearchInput
  value={employee}
  onChange={setEmployee}
  options={emps}
  placeholder="Search…"
  className={inputCls + ' w-44'}
/>
```

`emps` (`EmpInfo[]`, field `name`) is already loaded in this file. The label,
dividers and everything else stay as they are.

## Verify

On `/pto`, `/attendance` and `/payroll-master`: typing `dom` lists Domingo Cruz;
ArrowDown + Enter fills the box with the full name and the table filters to
him; Clear filters empties the box; the dropdown is not clipped by the filter
bar or hidden under the table header; no layout shift in the bar.
