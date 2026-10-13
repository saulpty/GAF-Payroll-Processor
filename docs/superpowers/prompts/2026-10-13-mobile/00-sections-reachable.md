# Phone: the sections can be changed again (top bar makes room for them)

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Plan step M0 (`docs/superpowers/plans/2026-10-12-mobile-view.md`). On a phone the navy top bar
has no room left for the row of sections, so a person cannot move from Attendance to PTO or
Contracts. The row of sections already slides sideways (`flex-1 min-w-0 overflow-x-auto`); it is
0 px wide only because the Refresh pill and the name pill beside it will not shrink.

This prompt hides three pieces of **text** on a screen narrower than 768 px. The icons, the pills
and every `title` / `aria-label` stay:

- the word **Refresh** / **Refreshing…** in the Refresh pill (the circular-arrows icon stays);
- the **name** and the **role** in the name pill (the person icon stays);
- the two words **Viewing As** in the amber View As pill. **The person's name in that pill is
  never hidden**, and neither is its eye icon or its X.

The sum at 375 px wide, not viewing as anyone: 32 (the bar's side padding) + 61 (logo block) +
48 (Refresh pill, icon only) + 48 (name pill, icon only) = 189, which leaves **186 px** for the
row of sections. Today it gets 0. While viewing as someone the amber pill keeps the person's name,
so the row gets less (about 90 px for a name the length of "Maria Lopez"); it still slides.

**Only these files may change.** Two edited: `src/app/TopNav.tsx`,
`src/app/components/RefreshButton.tsx`. **No other file may be touched.** No migration, no action
file.

Rules that hold for every prompt in this folder:

- Only these files may change: the two listed above. No other file may be touched. No action file, no migration.
- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- With a mouse on a screen 768 px or wider, nothing may look or behave differently.
- Every file stays under 15 KB.
- Never `window.location.reload()` and never `history.pushState` / `replaceState`.

The only classes added here are the pair `hidden md:inline`, four times, each on a new `<span>`:
hidden below 768 px, shown exactly as before from 768 px up. Do not add any other class, and do
not use `max-md:`. `<RefreshButton />` stays directly above the line `{isViewingAs ? (`. Nothing
is imported, no logic changes, and no element is added other than the `<span>`s written below.

## 1. `src/app/components/RefreshButton.tsx` — one edit, nothing else

**1a.** Replace

```tsx
      {busy ? 'Refreshing…' : 'Refresh'}
```

with

```tsx
      <span className="hidden md:inline">{busy ? 'Refreshing…' : 'Refresh'}</span>
```

The `title`, the `aria-label="Refresh data"`, the `disabled={busy}` and the button's own
`className` stay exactly as they are.

## 2. `src/app/TopNav.tsx` — two edits, nothing else

**2a.** In the amber View As button, replace

```tsx
          Viewing As {name || email}
```

with

```tsx
          <span><span className="hidden md:inline">Viewing As </span>{name || email}</span>
```

There is one space after `Viewing As`, inside the inner `<span>`. `{name || email}` sits outside
the inner `<span>`: the name must show at every width.

**2b.** In the name pill, replace

```tsx
          {name || email}
          <span className="text-slate-300">· {isSuper ? 'Super User' : 'Manager'}</span>
```

with

```tsx
          <span className="hidden md:inline">{name || email}</span>
          <span className="hidden md:inline text-slate-300">· {isSuper ? 'Super User' : 'Manager'}</span>
```

The `<Eye …/>`, `<X …/>` and `<UserCircle …/>` icons, both pills' own `className`, the
`title` attributes and `onClick={() => setViewAs('')}` stay exactly as they are.

## Acceptance — visible facts

On a phone (the app's frame 375 px wide):

1. The navy top bar shows, left to right: the logo, the row of sections, a round pill with only
   the circular-arrows icon, a round pill with only the person icon.
2. The row of sections can be slid sideways with a finger, and every section can be reached: six
   for a super user (Payroll, Attendance, Disciplinary, Contracts, PTO Tracker, Admin), four for
   a manager. Tapping each one opens that section.
3. Tapping the icon-only Refresh pill spins the icon and reloads the page's data, as before.
4. While viewing as someone, the amber pill reads the eye icon, **the person's name**, and the X;
   tapping it stops viewing as that person.

On a computer nothing changes:

5. At 1440 px wide the top bar is identical to before: the Refresh pill reads **Refresh**, the
   name pill reads the name and `· Super User` or `· Manager`, the amber pill reads
   **Viewing As** and the name.
6. No console errors on load or after clicking.

When done, reply with a one-line summary per file.
