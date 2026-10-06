# Remove the big page title that repeats the navigation

**Copy every code block exactly, character for character. Do not rewrite or re-derive anything.**

With navigation option A the white second row already names the section and the page (e.g.
"Attendance · Activity", "PTO Tracker"). Saul (2026-10-06): the big title under it is redundant.
Keep the title for screen readers only (`sr-only`), keep the one-line description and the action
buttons exactly where they are. Pages affected: PTO Tracker, Contracts, Disciplinary, HRK Summary
(through the shared PageHeader), Admin → Employees and Admin → Access.

**Only these three files may change:**
- `src/app/components/PageHeader.tsx` — whole file below.
- `src/app/pages/admin/AdminEmployeesHub.tsx` — one edit below, nothing else.
- `src/app/pages/admin/AdminAccessHub.tsx` — one edit below, nothing else.

No other file may be touched (not `HrkSummary.tsx`, `PtoTracker.tsx`, `Contracts.tsx`,
`Disciplinary.tsx`, any payroll page, any action, or `src/components/ui/*`).

## `src/app/components/PageHeader.tsx` (whole file)

```tsx
import type { ReactNode } from 'react';

// The visible page name lives in the navigation's second row (SectionBar) since 2026-10-06, so
// the title here is for screen readers only; the description and the actions stay visible.
export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
      <div className="min-w-0">
        <h1 className="sr-only">{title}</h1>
        {subtitle && <p className="text-[13px] text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
```

## `src/app/pages/admin/AdminEmployeesHub.tsx`: one edit

Replace exactly

```tsx
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Employees</h1>
```

with exactly

```tsx
          <h1 className="sr-only">Employees</h1>
```

## `src/app/pages/admin/AdminAccessHub.tsx`: one edit

Replace exactly

```tsx
          <h1 className="text-lg font-bold text-slate-800 leading-tight">Access</h1>
```

with exactly

```tsx
          <h1 className="sr-only">Access</h1>
```

## Report
- Byte size of the three files; confirm no other file changed; PTO Tracker, Contracts and
  Admin → Employees render with no console errors.
