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

---

# Results — 2026-09-07

**changed: 3, added: 0.** `app.tsx` gained one import and one route,
`FilterBar.tsx` one `ROUTE_CONFIG` line, `TopNav.tsx` one section plus the badge
fix. `classificationEngine.ts` untouched. Suite 139/139.

## The page, loaded on `/dev/` and read rather than assumed

- Header: **`10 employees · 16 actions · 16 open`**, matching the probe exactly.
- **Nav badge reads 16.**
- Every row carries a red `review overdue` chip — the page opens entirely red,
  which is the true state of the data.
- **Juan Molina and Osvaldo Medina render muted with an `inactive` chip and still
  show a role**, taken from the disciplinary record because their roster role is
  NULL. That is the probe-driven correction working on screen.
- Sorted by severity: Timothy Moore's Second Written first, then the three First
  Writtens, then the Verbals.

## Timothy Moore — the acceptance case, passed exactly

Header strip: 4 actions · Second Written Warning · escalation 3 of 4 · last
action 07-09-2026. His **Latest** column reads a *Verbal*, one rung below his
highest — the disagreement that justifies the design.

His file rendered in this order:

```
GAF-DA-2026-5763   07-01  Verbal
GAF-DA-2026-7033   07-01  First Written
GAF-DA-2026-9269   07-01  Second Written
GAF-DA-2026-5106   07-09  Verbal
```

Three of those share a `document_date` **and** an identical `submitted_at`. That
order is only reachable through the `id DESC` tiebreak, reversed for display.

## The badge fix, proved by an accident of timing

Acceptance asked for "two badges showing different numbers". What happened is
better: **Contracts shows no badge at all**, because Carlos Aloma's contract
ended 2026-09-02 and nothing expires within 30 days.

Under the old hardcoded condition — `s.badge && expiringCount > 0` — Disciplinary
would have read that same zero and rendered nothing. **It shows 16.** So
`sectionBadge` is genuinely resolving per section, which two arbitrary non-zero
numbers would have demonstrated less conclusively.

The Action Required sub-link badge still uses `unresolvedCount` and was not
touched.

## The write path, both directions

Closed Timothy Moore's oldest action from the expanded file:

- the dialog opened titled **Close case**, subtitled `Timothy Moore ·
  GAF-DA-2026-5763`, with **Closed by** prefilled `Saul Fallenbaum` — the
  manager who filed it — and an optional note;
- on submit the header went **`16 open` → `15 open`**, which is `06b`'s
  `onChanged={reload}` doing its job;
- the card footer became *Closed 09-07-2026 by Saul Fallenbaum — …* with a
  **Reopen** link.

**Reopen restored it exactly**: back to `16 open`, all four Close case buttons
returned, zero `Closed` rows. Both counts are database reads, since the reload
re-queries — the screen was not trusted on its own.

## Known and accepted

The **nav badge does not live-update**. It loads once when `TopNav` mounts, so
closing a case updates the table immediately but the badge only on the next page
load. The Contracts badge behaves the same way. Not worth a round.
