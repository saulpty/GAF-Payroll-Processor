# 01 — Make the ⓘ tooltips actually appear

The `InfoTip` component puts `title=` on the lucide `<svg>` element. Browsers do
not show a tooltip for a `title` attribute on an SVG element, so every ⓘ on
Contracts, PTO Tracker and Disciplinary shows nothing on hover.

## Files you may change

- `src/app/components/InfoTip.tsx`
- `src/app/pages/contracts/ContractRow.tsx` — one attribute

**No other file may be touched.**

## 1. `InfoTip.tsx`

Wrap the icon in a span that carries the tooltip:

```tsx
import { Info } from 'lucide-react';

export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="inline-flex align-[-1px] ml-1 cursor-help" title={text} aria-label={text} tabIndex={0}>
      <Info className="w-3 h-3 text-slate-400" aria-hidden="true" />
    </span>
  );
}
```

## 2. `ContractRow.tsx`

The past-milestone `✔` cell has `title={fmtDate(m.date)}` — a bare date that
explains nothing. Change it to `` title={`${MS_TIPS[m.key]} Reached ${fmtDate(m.date)}.`} ``.
Nothing else in the file changes.

## Verify

- On `/contracts`, hovering the ⓘ next to *Position* shows "From the Employee
  Onboarding board." Same on `/pto` headers.
- Only the two files changed. Confirm every identifier used in each file is imported.
