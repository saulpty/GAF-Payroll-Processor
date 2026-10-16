# Roster shows a Country badge for non-Panama employees

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else.**

`loadAllEmployees` now returns `country`. In Admin → Employees → Roster, show a small grey badge
after the name of anyone whose country is not Panama, so it is obvious why they never appear in
payroll. Read-only: the Monday Directory board owns the value.

**Only these files may change:** `src/app/pages/admin/employees/RosterTab.tsx` and, only if
`EmpRow` lacks the field, `src/app/pages/admin/employees/rosterTypes.ts` (add `country?: string;`).
**No other file may be touched.**

Rules: the untouchable files as usual; under 15 KB; nothing else on the page changes.

## 1. `RosterTab.tsx`

Replace the name cell

```tsx
                <td className="px-3 py-2 border-r font-medium">{emp.display_name}</td>
```

with

```tsx
                <td className="px-3 py-2 border-r font-medium">
                  {emp.display_name}
                  {emp.country && emp.country !== 'Panama' && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600"
                      title="Not in payroll or PTO: Country comes from the Monday Directory board">
                      {emp.country}
                    </span>
                  )}
                </td>
```

> DRAFT NOTE: re-check the "before" line against the fresh export (the mobile-rows work may have
> touched Roster). Prefer the colour tokens in `src/DESIGN.md` if slate is not what the page uses.
