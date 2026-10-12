# A Refresh button in the top bar, next to the user's name

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-12): a button in the navy top bar, just left of the name pill, that refreshes
everything by hand.
- **Super user:** runs the three background syncs right now (Monday boards, Teramind time
  records, access groups) without waiting for the interval, then reloads the page's data.
- **Manager (or a super user in View As):** only reloads the page's data from the saved copies.
  Managers must still never trigger a Monday or Teramind pull — the syncs only register
  themselves for a super user, so for a manager there is nothing to run.

**Only these files may change.** Two new: `src/app/lib/refreshBus.ts`,
`src/app/components/RefreshButton.tsx`. Seven edited: `src/app/context/GlobalFilterContext.tsx`,
`src/app/app.tsx`, `src/app/TopNav.tsx`, `src/app/components/AccessAutoSync.tsx`,
`src/app/components/TeramindAutoSync.tsx`, `src/app/components/MondayAutoSync.tsx`,
`src/AGENTS.md`. **No other file may be touched.** No migration, no action file, no page file.
Never use `window.location.reload()` — the app lives in an iframe and a reload 404s.

## 1. New file `src/app/lib/refreshBus.ts` — the whole file

```ts
// Plumbing for the top-bar Refresh button. Each background sync registers its runner here
// (only while a super user is signed in); the button runs them all with force = true.
// Pure module: no imports.

type SyncRunner = (force?: boolean) => Promise<void>;

const runners = new Map<string, SyncRunner>();

export function registerSync(name: string, run: SyncRunner): () => void {
  runners.set(name, run);
  return () => { if (runners.get(name) === run) runners.delete(name); };
}

/** Runs every registered sync now, ignoring the interval. Never throws. */
export async function runAllSyncs(): Promise<void> {
  await Promise.allSettled([...runners.values()].map(run => run(true)));
}
```

## 2. New file `src/app/components/RefreshButton.tsx` — the whole file

```tsx
import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalFilters } from '@/app/context/GlobalFilterContext';
import { runAllSyncs } from '@/app/lib/refreshBus';

// Module-level: one refresh at a time, even though the bar remounts when it finishes.
let running = false;

/** Top-bar Refresh: runs the background syncs now (super users only have any), then reloads the page's data. */
export default function RefreshButton() {
  const { bumpRefreshVersion } = useGlobalFilters();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [busy, setBusy] = useState(running);

  async function refresh() {
    if (running) return;
    running = true;
    setBusy(true);
    try {
      await runAllSyncs();
    } finally {
      running = false;
      setBusy(false);
    }
    // Process Payroll keeps an unsaved run in page state: never remount it.
    if (!pathRef.current.startsWith('/process')) bumpRefreshVersion();
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      title={busy ? 'Refreshing data…' : 'Refresh data now'}
      aria-label="Refresh data"
      className="ml-3 shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-medium bg-white/10 text-white border border-white/20 hover:bg-white/20 disabled:opacity-70 disabled:cursor-wait"
    >
      <RefreshCw className={cn('w-3.5 h-3.5', busy && 'animate-spin')} />
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  );
}
```

## 3. `src/app/context/GlobalFilterContext.tsx` — four edits, nothing else

**3a.** In `interface GlobalFilters`, directly after the line `  bumpArVersion: () => void;` add:

```ts
  refreshVersion: number;
  bumpRefreshVersion: () => void;
```

**3b.** Directly after the line `  const bumpArVersion = () => setArVersion(v => v + 1);` add:

```ts
  const [refreshVersion, setRefreshVersion] = useState(0);
  const bumpRefreshVersion = () => setRefreshVersion(v => v + 1);
```

**3c.** In the `useMemo` value, directly after the line `    arVersion, bumpArVersion,` add:

```ts
    refreshVersion, bumpRefreshVersion,
```

**3d.** In that `useMemo`'s dependency array, replace `[periodsVersion, ptoVersion, arVersion, period,`
with `[periodsVersion, ptoVersion, arVersion, refreshVersion, period,`.

## 4. `src/app/app.tsx` — four edits, nothing else

**4a.** Replace

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
```

with

```tsx
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
```

**4b.** Replace

```tsx
import { GlobalFilterProvider } from '@/app/context/GlobalFilterContext';
```

with

```tsx
import { GlobalFilterProvider, useGlobalFilters } from '@/app/context/GlobalFilterContext';
```

**4c.** Directly above the line `function App() {` add (with one blank line after it):

```tsx
// The Refresh button bumps refreshVersion; the new key remounts the bars and the page so every
// loader refetches. The three background syncs sit outside it and keep running.
function RefreshBoundary({ children }: { children: ReactNode }) {
  const { refreshVersion } = useGlobalFilters();
  return (
    <div key={refreshVersion} className="flex flex-col h-screen overflow-hidden bg-background">
      {children}
    </div>
  );
}
```

**4d.** Inside `App`, replace the opening tag

```tsx
            <div className="flex flex-col h-screen overflow-hidden bg-background">
```

with

```tsx
            <RefreshBoundary>
```

and replace its matching closing `</div>` (the one directly after `</main>`) with
`</RefreshBoundary>`. `<AccessAutoSync />`, `<TeramindAutoSync />` and `<MondayAutoSync />` stay
exactly where they are, above it. `<TopNav />` and `<SectionBar />` stay on consecutive lines.
No route changes.

## 5. `src/app/TopNav.tsx` — two edits, nothing else

**5a.** Directly after the line `import BrandLogo from '@/app/components/BrandLogo';` add:

```tsx
import RefreshButton from '@/app/components/RefreshButton';
```

**5b.** Directly above the line `      {isViewingAs ? (` add:

```tsx
      <RefreshButton />

```

## 6. `src/app/components/AccessAutoSync.tsx` — four edits, nothing else

**6a.** Directly after the line `import loadClassificationConfigAction from '@/actions/loadClassificationConfig';` add:

```ts
import { registerSync } from '@/app/lib/refreshBus';
```

**6b.** Replace `    async function maybeSync() {` with `    async function maybeSync(force = false) {`.

**6c.** Replace

```ts
      if (lastRunMs > 0 && Date.now() - lastRunMs < intervalMs) return;
```

with

```ts
      if (!force && lastRunMs > 0 && Date.now() - lastRunMs < intervalMs) return;
```

**6d.** Replace

```ts
    return () => { clearTimeout(first); clearInterval(timer); };
```

with

```ts
    const unregister = registerSync('access', maybeSync);
    return () => { clearTimeout(first); clearInterval(timer); unregister(); };
```

The lines `useEffect(() => {` / `if (!isSuper) return;` and `}, [isSuper]);` must stay exactly as they are.

## 7. `src/app/components/TeramindAutoSync.tsx` — five edits, nothing else

**7a.** Directly after the line `import { easternDate } from '@/app/lib/teramindTime';` add:

```ts
import { registerSync } from '@/app/lib/refreshBus';
```

**7b.** Replace `    async function maybeSync() {` with `    async function maybeSync(force = false) {`.

**7c.** Replace

```ts
      if (lastFailureMs > 0 && Date.now() - lastFailureMs < intervalMs) return;
```

with

```ts
      if (!force && lastFailureMs > 0 && Date.now() - lastFailureMs < intervalMs) return;
```

**7d.** Replace

```ts
      if (lastAutoMs > 0 && Date.now() - lastAutoMs < intervalMs) return;
```

with

```ts
      if (!force && lastAutoMs > 0 && Date.now() - lastAutoMs < intervalMs) return;
```

**7e.** Replace

```ts
    return () => { clearTimeout(first); clearInterval(timer); };
```

with

```ts
    const unregister = registerSync('teramind', maybeSync);
    return () => { clearTimeout(first); clearInterval(timer); unregister(); };
```

`if (!isSuper) return;`, `if (document.hidden) return;`, `if (inFlight) return;`, `let inFlight = false;`
and `await pullRange(range.from, range.to, 'auto');` must stay exactly as they are.

## 8. `src/app/components/MondayAutoSync.tsx` — five edits, nothing else

**8a.** Directly after the line `import { easternDate } from '@/app/lib/teramindTime';` add:

```ts
import { registerSync } from '@/app/lib/refreshBus';
```

**8b.** Replace `    async function maybeSync() {` with `    async function maybeSync(force = false) {`.

**8c.** Replace

```ts
      const due = BOARDS.filter(b => {
```

with

```ts
      const due = force ? BOARDS : BOARDS.filter(b => {
```

**8d.** Replace

```ts
            const claimResp = await claimRun({ kind: board.kind, ranBy: 'auto', intervalMinutes });
```

with

```ts
            // A forced run (Refresh button) still skips a board another run claimed in the last minute.
            const claimResp = await claimRun({ kind: board.kind, ranBy: 'auto', intervalMinutes: force ? 1 : intervalMinutes });
```

**8e.** Replace

```ts
    return () => { clearTimeout(first); clearInterval(timer); };
```

with

```ts
    const unregister = registerSync('monday', maybeSync);
    return () => { clearTimeout(first); clearInterval(timer); unregister(); };
```

The Teramind roster block (`intervalMinutes: 1440`) and everything else in the file stay unchanged.

## 9. `src/AGENTS.md` — one addition

Directly after the line that ends `see BACKLOG #16 before relying on this for anything sensitive.`
add a blank line and then:

```md
**Refresh button (added 2026-10-12)** — `src/app/components/RefreshButton.tsx`, in `TopNav` left of
the name pill, shown to everyone. It calls `runAllSyncs()` from `src/app/lib/refreshBus.ts`, then
`bumpRefreshVersion()`; `RefreshBoundary` in `app.tsx` is keyed on `refreshVersion`, so the bars and
the page remount and every loader refetches. The three `*AutoSync` components register their
`maybeSync(force)` with `registerSync` **inside** the `if (!isSuper) return;` effect, so a manager's
click runs no sync at all — it only reloads saved data. On `/process` the button never remounts
(an unsaved payroll run lives in page state). Never `window.location.reload()`.
```

## Acceptance — visible facts
1. On every page, the navy top bar shows a pill reading **Refresh** with a circular-arrows icon,
   directly left of the pill with the user's name.
2. Super user on Attendance → Today clicks it: the pill reads **Refreshing…** with the icon
   spinning and cannot be clicked again; when it finishes it reads **Refresh** again and the
   page's data reloads without the browser reloading. Admin → Employees → Monday then shows
   **Last Run** with the current time.
3. The chosen filters (period, employee, manager) are still set after a refresh.
4. On Payroll → Process, clicking Refresh never resets the step the user is on.
5. No console errors on load or after clicking.

When done, reply with a one-line summary per file.
