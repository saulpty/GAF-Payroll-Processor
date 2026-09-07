# Wire the Disciplinary page in: route, nav section, filter bar

**Modify exactly three existing files, and create nothing:**

- `src/app/app.tsx` — one route
- `src/app/TopNav.tsx` — one section, plus a fix to how badges are chosen
- `src/app/FilterBar.tsx` — one line

**No other file may be created, modified or deleted.** Do not touch any action,
anything under `src/app/pages/`, `src/app/lib/`, `src/app/pages/admin/`,
`src/components/ui/`, or any `Contracts*` or `Pto*` file. The page and its table
already exist; this prompt only makes them reachable.

## 1. `src/app/app.tsx`

Import `Disciplinary` from `@/app/pages/Disciplinary` and add one route
alongside the existing flat routes:

```tsx
<Route path="/disciplinary" element={<Disciplinary />} />
```

Change nothing else — no route reordering, no layout change.

## 2. `src/app/FilterBar.tsx`

Add exactly one line to `ROUTE_CONFIG`, after the `/contracts` line:

```tsx
'/disciplinary':          { employee: true, role: true, manager: true },
```

That is the whole change. The bar already renders those three controls, and
`getConfig` already handles the lookup. Do not touch `getConfig`, the control
rendering, or any other route's config.

## 3. `src/app/TopNav.tsx`

### 3a. The new section

Add one entry to `SECTIONS`, **between `contracts` and `pto`**, in the same shape
as the others:

```tsx
{
  id: 'disciplinary',
  label: 'Disciplinary',
  icon: ShieldAlert,          // from lucide-react
  home: '/disciplinary',
  color: 'from-[#BE123C] to-[#9F1239]',
  activeBg: 'bg-[#BE123C]',
  hoverBg: 'hover:bg-[#9F1239]',
  ring: 'ring-[#BE123C]/30',
  subActiveBg: 'bg-[#BE123C]/10 text-[#9F1239] font-semibold',
  subHover: 'hover:bg-[#BE123C]/5 text-slate-600',
  paths: ['/disciplinary'],
  links: [],
  badge: true,
},
```

Import `ShieldAlert` from `lucide-react` alongside the existing icons.

### 3b. The badge fix — this is the part that needs care

**The current badge rendering is hardcoded to the Contracts count:**

```tsx
{'badge' in s && s.badge && expiringCount > 0 && (
  <span … aria-label={`${expiringCount} contract${…} ending within 30 days`}>
    {expiringCount > 99 ? '99+' : expiringCount}
  </span>
)}
```

It works today only because Contracts is the sole section with `badge: true`.
**Adding a second badged section would print the contracts count on the
Disciplinary button.** So the badge must be chosen by section id.

Add the new count alongside the existing two loads:

```tsx
const asOf = toLocalYMD(new Date());
const [dueData] = useLoadAction(loadDisciplinaryDueCountAction, [] as { count: number }[], { asOf });
const dueCount  = (dueData as { count: number }[])[0]?.count ?? 0;
```

- `toLocalYMD` comes from `@/app/lib/classificationEngine` — **import it, never
  edit that file.** The action takes `asOf` so the badge and the page can never
  disagree about what day it is.
- Parameters go in **flat**: `{ asOf }`, never `{ params: { asOf } }`. That
  wrapper makes `{{params.asOf}}` undefined, and the query then fails or returns
  nothing with no error shown anywhere.
- Keep `loadUnresolvedCount` and `loadContractsExpiringCount` exactly as they
  are.

Then replace the hardcoded badge block with a per-section lookup:

```tsx
function sectionBadge(id: string): { count: number; label: string } | null {
  if (id === 'contracts' && expiringCount > 0) {
    return {
      count: expiringCount,
      label: `${expiringCount} contract${expiringCount === 1 ? '' : 's'} ending within 30 days`,
    };
  }
  if (id === 'disciplinary' && dueCount > 0) {
    return {
      count: dueCount,
      label: `${dueCount} disciplinary re-evaluation${dueCount === 1 ? '' : 's'} due`,
    };
  }
  return null;
}
```

and render it:

```tsx
{(() => {
  const b = 'badge' in s && s.badge ? sectionBadge(s.id) : null;
  return b && (
    <span
      className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none"
      aria-label={b.label}
    >
      {b.count > 99 ? '99+' : b.count}
    </span>
  );
})()}
```

Keep the `<span>` classes byte-for-byte as they are now, so the two badges are
visually identical.

### 3c. Leave the Action Required badge alone

The sub-link badge further down the file — the one driven by `unresolvedCount`
— is a different mechanism on a different loop. **Do not touch it, do not merge
it into `sectionBadge`, and do not change its markup.** It must keep working
exactly as it does now.

## Acceptance — observable outcomes

1. Exactly three files changed: `app.tsx`, `TopNav.tsx`, `FilterBar.tsx`. Nothing
   under `src/app/pages/` or `src/actions/` changed.
2. `/disciplinary` loads in the browser and shows one row per employee with a
   disciplinary action.
3. The nav shows **Disciplinary** between Contracts and PTO Tracker, and it
   highlights when the page is open.
4. **The two badges show different numbers**, each correct for its own section.
   This is the specific thing that would break: if the Disciplinary badge shows
   the contracts number, `sectionBadge` was not wired.
5. The Action Required sub-link badge still shows its own unresolved count.
6. The filter bar appears on `/disciplinary` with Employee, Role and Manager, and
   setting Manager narrows the table.
7. No file contains `{ params:`.
8. `classificationEngine.ts` was not modified.
9. Every other page still loads: `/contracts`, `/pto`, `/attendance`,
   `/action-required`, `/summary`.

Report the two badge numbers you see, and confirm they differ.
