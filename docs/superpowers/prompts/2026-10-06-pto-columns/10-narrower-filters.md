# Filters: cap dropdown width so Attendance → Activity fits on one row

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.**

On Attendance → Activity the Manager and Title dropdowns stretch to their longest option
("DevOps Engineer & Engineering Manager"), which pushes the filters onto a second line even on a
1680px screen. Cap them. The full text still shows in the open list.

**Only this file may change:** `src/app/FilterBar.tsx` — exactly two edits, nothing else in it.
No other file may be touched.

1. Replace exactly

```tsx
  const bareSel  = 'h-full max-w-[200px] bg-transparent text-[13px] text-slate-900 focus:outline-none';
```

with exactly

```tsx
  const bareSel  = 'h-full max-w-[130px] bg-transparent text-[13px] text-slate-900 focus:outline-none';
```

2. In the `<EmployeeSearchInput … />` element, replace exactly `className={inputCls + ' w-44'}`
   with exactly `className={inputCls + ' w-40'}`.

## Report
- Byte size of `FilterBar.tsx` (must stay under 15,000); confirm no other file changed.
