# 03 — The access-groups auto-sync runs for super users only

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may change. No other file may be touched.**

- `src/app/components/AccessAutoSync.tsx`

Do not create files. Do not touch `useAccessSync.ts`, `MondayAutoSync.tsx`, `TeramindAutoSync.tsx`,
`app.tsx` or any action. Do not reformat anything you are not asked to change.

## Why

`AccessAutoSync` is mounted for every signed-in viewer, and unlike its two siblings
(`MondayAutoSync.tsx` and `TeramindAutoSync.tsx`, which both start their effect with
`if (!isSuper) return;`) it has no super-user check. So in every **manager's** browser it loads
the full company roster (`loadAllEmployees`, unscoped), the full app-user list, pulls the Monday
board, and can write access groups. Managers must never run it. Super users keep it exactly as today.

## The change

1. Add the import, next to the existing imports:

```ts
import { useViewer } from '@/app/context/ViewerContext';
```

2. At the top of `AccessAutoSync()`, before `const sync = useAccessSync();`, add:

```ts
  const { isSuper } = useViewer();
```

3. Make the effect's first line inside `useEffect(() => {` be:

```ts
    if (!isSuper) return;
```

(before `async function maybeSync() {`).

4. Change the effect's dependency list from `}, []);` to `}, [isSuper]);` and keep the
`// eslint-disable-next-line react-hooks/exhaustive-deps` comment above it.

Nothing else in the file changes — the interval, the 20-second first delay, the
`sync_every_minutes` throttle and `lastRunMs` stay as they are.

## Acceptance

- `AccessAutoSync.tsx` imports `useViewer`, reads `isSuper`, returns early from the effect when
  it is false, and depends on `[isSuper]`.
- Viewing as a manager, no `loadAllEmployees` or `loadAppUsers` request fires in the background
  after 30 seconds on Attendance → Today. As a super user, behaviour is unchanged.
- `src/app/components/AccessAutoSync.tsx` is the only file changed.
