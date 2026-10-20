# Refresh button: flagged managers also pull fresh Monday data boards and Teramind punches

**Copy every edit exactly, character for character. Do not rewrite, reformat or "improve" anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

**Only these 16 files may change. No other file may be touched.** No migration (prompt 01 already
added `app_users.can_refresh_sync` and `public.assert_sync_writer`).

- `src/actions/loadCurrentViewer.ts`
- `src/app/lib/access.ts`
- `src/app/context/ViewerContext.tsx`
- `src/app/components/MondayAutoSync.tsx`
- `src/app/components/TeramindAutoSync.tsx`
- the 11 action files listed in section 6

`src/app/components/AccessAutoSync.tsx` does **not** change: access groups stay super-user only.
`public.assert_super` does not change, and every other action keeps it.

Rules that hold for this prompt:

- Never touch `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything in
  `src/components/ui/`.
- Every file stays under 15 KB (`MondayAutoSync.tsx` is about 14.2 KB now and must stay under
  15 KB after these edits).
- Never `window.location.reload()`.

## Why (Saul, 2026-10-20)

Arelis Acosta and Marcela (managers, not super users) press Refresh and only get a re-read of the
saved data. The Monday and Teramind syncs run only for super users, so when no super user has the
app open their data goes stale. Prompt 01 gave those two a `can_refresh_sync` flag. Now, for a
flagged non-super user:

- Refresh runs the Monday **requests**, **attendance_forms** and **contracts** boards and the
  Teramind punch pull. Never the **directory** board, never the Teramind roster, never access groups.
- Nothing runs on the 60-second timer for them: only when they press Refresh.
- Super users behave exactly as before.

## 1. `src/actions/loadCurrentViewer.ts`

Replace

```
             u.id, u.display_name, u.role, u.all_employees, u.active
```

with

```
             u.id, u.display_name, u.role, u.all_employees, u.active, u.can_refresh_sync
```

## 2. `src/app/lib/access.ts`

In `export type ViewerRow`, replace

```ts
  active: boolean | null;
};
```

(the first occurrence, the end of `ViewerRow`) with

```ts
  active: boolean | null;
  can_refresh_sync?: boolean | null;
};
```

## 3. `src/app/context/ViewerContext.tsx` — two edits

**3a.** In `export interface Viewer`, replace

```ts
  isSuper: boolean;
  allEmployees: boolean;
```

with

```ts
  isSuper: boolean;
  /** Super user, or a user flagged can_refresh_sync: Refresh pulls fresh Monday / Teramind data. */
  canRefreshSync: boolean;
  allEmployees: boolean;
```

**3b.** Replace

```ts
      isSuper: status === 'ready' && row?.role === 'super_user',
```

with

```ts
      isSuper: status === 'ready' && row?.role === 'super_user',
      canRefreshSync: status === 'ready' && (row?.role === 'super_user' || row?.can_refresh_sync === true),
```

## 4. `src/app/components/TeramindAutoSync.tsx` — three edits

**4a.** Replace

```ts
  const { isSuper } = useViewer();
```

with

```ts
  const { isSuper, canRefreshSync } = useViewer();
```

**4b.** Replace

```ts
  useEffect(() => {
    if (!isSuper) return;
```

with

```ts
  useEffect(() => {
    if (!canRefreshSync) return;
```

**4c.** Replace

```ts
    // Check on mount and then every 60 seconds
    const first = setTimeout(maybeSync, 20_000);
    const timer = setInterval(maybeSync, 60_000);
    const unregister = registerSync('teramind', maybeSync);
    return () => { clearTimeout(first); clearInterval(timer); unregister(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);
```

with

```ts
    const unregister = registerSync('teramind', maybeSync);
    // A flagged non-super user syncs only when they press Refresh, never on the timer.
    if (!isSuper) return unregister;
    // Check on mount and then every 60 seconds
    const first = setTimeout(maybeSync, 20_000);
    const timer = setInterval(maybeSync, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); unregister(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, canRefreshSync]);
```

## 5. `src/app/components/MondayAutoSync.tsx` — five edits

**5a.** Replace

```ts
  const { isSuper } = useViewer();
```

with

```ts
  const { isSuper, canRefreshSync } = useViewer();
```

**5b.** Replace

```ts
  useEffect(() => {
    if (!isSuper) return;
```

with

```ts
  useEffect(() => {
    if (!canRefreshSync) return;
```

**5c.** Replace

```ts
      const due = force ? BOARDS : BOARDS.filter(b => {
```

with

```ts
      // A flagged non-super user never runs the directory: its writes stay super-user only.
      const boards = isSuper ? BOARDS : BOARDS.filter(b => b.kind !== 'directory');
      const due = force ? boards : boards.filter(b => {
```

**5d.** Replace

```ts
        if (!lastRosterRun) {
```

with

```ts
        if (isSuper && !lastRosterRun) {
```

**5e.** Replace

```ts
    const first = setTimeout(maybeSync, 20_000);
    const timer = setInterval(maybeSync, 60_000);
    const unregister = registerSync('monday', maybeSync);
    return () => { clearTimeout(first); clearInterval(timer); unregister(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper]);
```

with

```ts
    const unregister = registerSync('monday', maybeSync);
    // A flagged non-super user syncs only when they press Refresh, never on the timer.
    if (!isSuper) return unregister;
    const first = setTimeout(maybeSync, 20_000);
    const timer = setInterval(maybeSync, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); unregister(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuper, canRefreshSync]);
```

## 6. The 11 data-copy actions — one identical edit in each

In each of these files, and **only** these, replace the one occurrence of

```
public.assert_super({{ user.email }}::text)
```

with

```
public.assert_sync_writer({{ user.email }}::text)
```

Change nothing else in them.

1. `src/actions/claimSyncRun.ts`
2. `src/actions/upsertSyncLog.ts`
3. `src/actions/upsertMondaySyncLog.ts`
4. `src/actions/upsertMondayRequests.ts`
5. `src/actions/upsertMondayAttendanceForms.ts`
6. `src/actions/upsertMondayContracts.ts`
7. `src/actions/updateMondayRequestsDeleted.ts`
8. `src/actions/updateMondayAttendanceFormsDeleted.ts`
9. `src/actions/updateMondayContractsDeleted.ts`
10. `src/actions/upsertTeramindSessions.ts`
11. `src/actions/upsertTeramindPullLog.ts`

## Acceptance

- Signed in as a super user: nothing changes. Background syncs still run every few minutes.
- View As Arelis Acosta, press Refresh: the button spins, the Admin → Employees → Monday cards'
  Requests / Attendance Forms / Contracts times update (check afterwards as a super user), and the
  browser console shows no "Only an active super user" error.
