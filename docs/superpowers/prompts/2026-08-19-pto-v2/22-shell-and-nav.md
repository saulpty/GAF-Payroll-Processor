Premium pass on the app shell plus five small app-level presentational components the PTO page will use.

Files that may be created: `src/app/components/PageHeader.tsx`, `src/app/components/DataTable.tsx`, `src/app/components/StatusChip.tsx`, `src/app/components/EmptyState.tsx`, `src/app/components/InfoTip.tsx`.
Files that may be modified: `src/app/TopNav.tsx`, `src/app/FilterBar.tsx`, `src/index.css`.
No other file may change — in particular nothing under `src/components/ui/`, and no page.

## 1. Nav change (TopNav.tsx)

Remove the `people` section object entirely. In its slot add a top-level section:
`id: 'pto'`, `label: 'PTO Tracker'`, `icon: Palmtree`, `home: '/pto'`, `paths: ['/pto']`, `links: []`, keeping the same purple colour values the People section had (`from-[#7C3AED] to-[#6D28D9]`, `bg-[#7C3AED]`, `hover:bg-[#6D28D9]`, `ring-[#7C3AED]/30`, and its sub styles).

When the active section has no links, render **no** sub-link row at all — not an empty strip. Every other section keeps its current links and behaviour.

## 2. Style brief (applies to everything in this prompt)

Accessibility first: text contrast at least 4.5:1, every interactive element reachable and operable by keyboard, icon-only controls carry an `aria-label`, and the sort buttons expose `aria-sort`. Respect `prefers-reduced-motion` by keeping transitions to colour only.

- Spacing on an 8-pt grid (4 / 8 / 12 / 16 / 24 / 32).
- Type scale: page title 18/600, section label 11/600 uppercase tracking-wide muted, body 13, caption 12 muted.
- Brand stays: navy `--primary` for primary actions, teal `--secondary` for positive chips, purple only as the PTO section accent. No gradient fills on buttons; the nav's section gradient may stay but softened.
- Surfaces: white cards, `border border-slate-200`, and a new card shadow token. Radius 10px cards, 8px inputs/buttons, full for chips.
- Tables: 13px body, `tabular-nums`, numeric columns right-aligned, header an uppercase caption on `bg-slate-50`, row `hover:bg-slate-50/80`, no zebra striping, 1px `border-slate-100` dividers.
- Focus: visible `ring-2 ring-primary/30` on every interactive element.
- Transitions 150ms, colour only. No layout animation.

### index.css
Add to `:root`:
`--shadow-card: 0 1px 2px rgb(15 23 42 / 0.04), 0 1px 3px rgb(15 23 42 / 0.06);`
and under `@layer utilities` a `.shadow-card { box-shadow: var(--shadow-card); }`. Change nothing else in this file — no existing token may be redefined.

### TopNav.tsx
Keep the component's structure, section ids and routing behaviour; restyle only. Brand block: the GAF mark, "GAF Healthcare" at 14/700, and a 10px caption reading `HR Hub` (replacing "Planilla · Payroll System"). Section buttons become 32px-tall pills, 13/500, 8px gap; the active pill uses the section colour, inactive is `text-slate-600 hover:bg-slate-100`. When a section does have links, the sub-row is a 36px strip with 12/500 links using the section's `subActiveBg` / `subHover`. Do not touch UI Bakery's own chrome (the dev/staging/prod chips and Edit button).

### FilterBar.tsx
Keep every behaviour and the per-route visibility map exactly as it is — no filter added, removed or re-scoped. Restyle: 48px bar, `bg-white border-b border-slate-200`; each control preceded by an 11px uppercase muted caption label; inputs and selects 32px tall, `rounded-lg border-slate-200`; the clear-all affordance a quiet text button on the right.

## 3. New components — use exactly these exports and implementations

```tsx
// src/app/components/PageHeader.tsx
import type { ReactNode } from 'react';

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
```

```tsx
// src/app/components/InfoTip.tsx
import { Info } from 'lucide-react';

export default function InfoTip({ text }: { text: string }) {
  return <Info className="inline-block w-3 h-3 ml-1 text-slate-400 align-[-1px]" aria-label={text} title={text} />;
}
```

```tsx
// src/app/components/StatusChip.tsx
import type { ReactNode } from 'react';

export type ChipTone = 'green' | 'amber' | 'red' | 'slate' | 'violet' | 'blue';

const TONES: Record<ChipTone, string> = {
  green:  'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber:  'bg-amber-50 text-amber-700 ring-amber-600/15',
  red:    'bg-red-50 text-red-700 ring-red-600/15',
  slate:  'bg-slate-100 text-slate-600 ring-slate-500/10',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  blue:   'bg-sky-50 text-sky-700 ring-sky-600/15',
};

export default function StatusChip({ tone, icon, children, strike }: { tone: ChipTone; icon?: ReactNode; children: ReactNode; strike?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]} ${strike ? 'line-through opacity-70' : ''}`}>
      {icon}{children}
    </span>
  );
}
```

```tsx
// src/app/components/EmptyState.tsx
import type { ReactNode } from 'react';

export default function EmptyState({ icon, title, hint, action, compact }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-slate-200 bg-white ${compact ? 'py-6' : 'py-10'}`}>
      {icon && <div className="text-slate-300 mb-2">{icon}</div>}
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
```

```tsx
// src/app/components/DataTable.tsx
import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import InfoTip from './InfoTip';

export type Col<T> = { key: keyof T | string; label: string; align?: 'left' | 'right' | 'center'; tip?: string; sortable?: boolean; width?: string };

export default function DataTable<T>({ columns, sortKey, sortDir, onSort, children, stickyHeader = true, dense = false, className = '' }: {
  columns: Col<T>[]; sortKey: string | null; sortDir: 'asc' | 'desc' | null; onSort: (key: string) => void;
  children: ReactNode; stickyHeader?: boolean; dense?: boolean; className?: string;
}) {
  const pad = dense ? 'px-3 py-1.5' : 'px-3 py-2';
  return (
    <div className={`overflow-auto rounded-xl border border-slate-200 bg-white shadow-card ${className}`}>
      <table className="w-full text-[13px] text-slate-700">
        <thead className={`${stickyHeader ? 'sticky top-0 z-10' : ''} bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500`}>
          <tr className="border-b border-slate-200">
            {columns.map(c => {
              const k = String(c.key);
              const active = sortKey === k && sortDir !== null;
              const al = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left';
              const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={k} style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`${pad} font-semibold ${al} whitespace-nowrap`}>
                  {c.sortable === false ? (
                    <span>{c.label}{c.tip && <InfoTip text={c.tip} />}</span>
                  ) : (
                    <button type="button" onClick={() => onSort(k)}
                      className={`inline-flex items-center gap-1 rounded px-1 -mx-1 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? 'text-slate-900' : ''}`}>
                      {c.label}{c.tip && <InfoTip text={c.tip} />}
                      <Icon className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} aria-hidden="true" />
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
```

## Constraints
- Each file under 15 KB.
- No page imports these components yet — that comes in a later prompt.
- No behaviour change in FilterBar or in TopNav's routing.
- No Monday board, column or group id anywhere.
