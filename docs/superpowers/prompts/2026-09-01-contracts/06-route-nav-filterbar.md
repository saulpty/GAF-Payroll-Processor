# Wire the Contracts page into the app

**Modify exactly three existing files:**

- `src/app/app.tsx`
- `src/app/TopNav.tsx`
- `src/app/FilterBar.tsx`

**No other file may be created, modified or deleted.** Do not touch
`Contracts.tsx`, `ContractsTable.tsx`, `ContractRow.tsx`, `tenure.ts`, the
`loadContract*` actions, or any page under `src/app/pages/` other than through
the import added to `app.tsx`.

These three files are small and shared by every page in the app. **Make the
minimum edit in each.** Do not reformat, reorder imports, or "tidy" anything you
pass on the way.

## 1. `app.tsx` — one import, one route

```tsx
import Contracts from '@/app/pages/Contracts';
```

and, next to the existing `/pto` route:

```tsx
<Route path="/contracts" element={<Contracts />} />
```

Nothing else in this file changes.

## 2. `FilterBar.tsx` — one line

Add to `ROUTE_CONFIG`:

```ts
'/contracts': { employee: true, role: true, manager: true },
```

The bar already knows how to render those three controls. **Do not** add a
`dateRange`, `period`, `statusTab` or `pmTab` entry for this route, and do not
touch any other route's config.

## 3. `TopNav.tsx` — a new section, and a section-level badge

### 3a. The section

Add a new entry to `SECTIONS`, positioned **between the `attendance` section and
the `pto` section**:

```ts
{
  id: 'contracts',
  label: 'Contracts',
  icon: FileSignature,              // add to the existing lucide-react import
  home: '/contracts',
  color: 'from-[#B45309] to-[#92400E]',
  activeBg: 'bg-[#B45309]',
  hoverBg: 'hover:bg-[#92400E]',
  ring: 'ring-[#B45309]/30',
  subActiveBg: 'bg-[#B45309]/10 text-[#92400E] font-semibold',
  subHover: 'hover:bg-[#B45309]/5 text-slate-600',
  paths: ['/contracts'],
  links: [],
  badge: true,
},
```

Also add `'contracts'` to the `SectionId` union type.

`links: []` matches the `pto` section, so no sub-link bar renders.

### 3b. The badge — the one non-trivial part

Today `badge: true` is honoured **only on sub-links**, inside the sub-link
`map`, driven by `unresolvedCount`. Contracts has no sub-links, so the count has
to render on the **section button** itself.

- Load the count alongside the existing one, using the same idiom:

  ```ts
  const [expiringData] = useLoadAction(loadContractsExpiringCountAction, [] as { count: number }[]);
  const expiringCount = (expiringData as { count: number }[])[0]?.count ?? 0;
  ```

- In the `SECTIONS.map` that renders the section buttons, when a section has
  `badge: true` **and** its count is greater than 0, render the same red pill
  already used for Action Required:

  ```tsx
  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
    {n > 99 ? '99+' : n}
  </span>
  ```

- **When the count is 0, render no pill at all.** Not a grey zero, nothing.

- Give the pill an accessible name so it is not a bare number to a screen
  reader — e.g. wrap or label it as `1 contract ending within 30 days`.

**Do not change the Action Required badge.** It stays on its sub-link, driven by
`unresolvedCount`, and must still show `62`. If your change makes the section
buttons render `unresolvedCount`, it is wrong.

## Constraints

- Keep every existing section's styling and behaviour byte-identical.
- No new dependencies. `FileSignature` comes from `lucide-react`, already
  imported in this file.
- TypeScript clean.

## Acceptance

Loading the app after this change:

- A **Contracts** button appears between Attendance and PTO Tracker, carrying a
  red **1**.
- Clicking it navigates to `/contracts` and the page renders 44 rows.
- The filter bar on `/contracts` shows Employee, Manager and Role, and nothing
  else.
- **Action Required still shows its own badge, unchanged.**
- Every other page still loads and its nav still looks exactly as before.
