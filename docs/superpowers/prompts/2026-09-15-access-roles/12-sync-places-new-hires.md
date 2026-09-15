# 12 — Directory sync places new hires into their manager's group

## Files that may change

- `src/app/pages/admin/access/seedFromMonday.ts` — one optional dependency
- `src/app/pages/admin/access/useGroupPlacement.ts` (new)
- `src/app/pages/admin/employees/MondayTab.tsx` — one import, one hook line, a few lines in `onSyncDirectory`

No other file may be touched. Do NOT edit `syncDirectory.ts` or `mondaySync.ts`.
`MondayTab.tsx` must stay under 15 KB.

## Why

After groups exist, a new hire added by **Sync now** on the Directory card must
land in the group whose **primary manager's email** matches the Manager Email
on their Monday row, so their manager can see them straight away. This only
places employees who are in **no** group yet. It never creates users or groups,
never moves anyone, never removes anyone. If it fails, the directory sync itself
still succeeds.

`seedFromMonday` already supports this with `mode: 'newOnly'`. One gap: the
sync may have **just created** the employee, and the page's resolver was built
from the employee list loaded before that. So placement must resolve against a
freshly fetched employee list.

## 1. `src/app/pages/admin/access/seedFromMonday.ts`

- Add to `SeedDeps`: `fetchEmployees?: () => Promise<unknown>; // loadAllEmployees, fresh`
- In `seedFromMonday`, just before `planAccessSeed` is called:
  ```ts
  const freshByEmail = new Map<string, string>();
  if (deps.fetchEmployees) {
    for (const r of rowsOf(await deps.fetchEmployees())) {
      const e = norm(r.teramind_email);
      if (e) freshByEmail.set(e, String(r.id));
    }
  }
  ```
- Change the resolver passed to `planAccessSeed` to try that map first:
  ```ts
  p => {
    const byEmail = p.email ? freshByEmail.get(p.email) : undefined;
    if (byEmail) return byEmail;
    const id = deps.resolve(p.name, p.email || null);
    return id === null ? null : String(id);
  }
  ```

Nothing else in the file changes.

## 2. `src/app/pages/admin/access/useGroupPlacement.ts` (new)

A small hook so `MondayTab.tsx` stays small. Params flat.

```ts
import { useCallback } from 'react';
import { useMutateAction } from '@uibakery/data';
import pullMondayBoardAction from '@/actions/pullMondayBoard';
import loadAllEmployeesAction from '@/actions/loadAllEmployees';
import loadAppUsersAction from '@/actions/loadAppUsers';
import loadAccessGroupsAction from '@/actions/loadAccessGroups';
import loadAccessGroupMembersAction from '@/actions/loadAccessGroupMembers';
import upsertAppUserAction from '@/actions/upsertAppUser';
import upsertAccessGroupAction from '@/actions/upsertAccessGroup';
import upsertAccessGroupManagerAction from '@/actions/upsertAccessGroupManager';
import upsertAccessGroupMemberAction from '@/actions/upsertAccessGroupMember';
import { seedFromMonday } from './seedFromMonday';
import type { SeedResult } from './seedFromMonday';

export function useGroupPlacement() {
  const [pull]          = useMutateAction(pullMondayBoardAction);
  const [fetchEmps]     = useMutateAction(loadAllEmployeesAction);
  const [fetchUsers]    = useMutateAction(loadAppUsersAction);
  const [fetchGroups]   = useMutateAction(loadAccessGroupsAction);
  const [fetchMembers]  = useMutateAction(loadAccessGroupMembersAction);
  const [upsertUser]    = useMutateAction(upsertAppUserAction);
  const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
  const [upsertManager] = useMutateAction(upsertAccessGroupManagerAction);
  const [upsertMember]  = useMutateAction(upsertAccessGroupMemberAction);

  return useCallback(async (
    cfg: Record<string, string>,
    resolve: (name: string | null | undefined, email: string | null | undefined) => number | null,
  ): Promise<SeedResult | null> => {
    if (!cfg.monday_col_directory_manager_email) return null;
    return seedFromMonday({
      cfg, resolve, mode: 'newOnly',
      pull: p => pull(p),
      fetchEmployees: () => fetchEmps({}),
      fetchUsers: () => fetchUsers({}),
      fetchGroups: () => fetchGroups({}),
      fetchMembers: () => fetchMembers({}),
      upsertUser, upsertGroup, upsertManager, upsertMember,
    });
  }, [pull, fetchEmps, fetchUsers, fetchGroups, fetchMembers, upsertUser, upsertGroup, upsertManager, upsertMember]);
}
```

## 3. `src/app/pages/admin/employees/MondayTab.tsx`

- Add `import { useGroupPlacement } from '@/app/pages/admin/access/useGroupPlacement';`
- Next to the other hooks: `const placeInGroups = useGroupPlacement();`
- In `onSyncDirectory`, replace `return syncDirectory(dirDeps);` with:
  ```ts
  const result = await syncDirectory(dirDeps);
  try {
    const placed = await placeInGroups(cfg, resolver);
    if (placed) setDirSummary(s => `${s ?? ''} · ${placed.membersAdded} placed in access groups`);
  } catch (e) {
    setDirSummary(s => `${s ?? ''} · access group placement failed: ${e instanceof Error ? e.message : String(e)}`);
  }
  return result;
  ```
- Add `placeInGroups` to that `useCallback`'s dependency array.

Change nothing else.

## Acceptance

1. Lint clean. Report the byte size of `MondayTab.tsx` (must be under 15 KB) and the new file.
2. Then confirm every identifier used in each changed file is imported.
3. Do not press Sync now yourself.

Do not build anything else.
