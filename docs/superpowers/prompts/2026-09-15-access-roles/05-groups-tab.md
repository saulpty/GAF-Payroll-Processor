# 05 — Admin > Access > Groups

## Files that may change

- `src/app/pages/admin/access/GroupsTab.tsx` (new)
- `src/app/pages/admin/access/GroupCard.tsx` (new)
- `src/app/pages/admin/AdminAccessHub.tsx` — replace the Groups placeholder only

No other file may be touched. Do not create, delete, rename or reformat
anything else. Never touch anything under `src/components/ui/`.

## Why

A **group** is a department: a list of employees plus the managers who may see
them. A group has one primary manager and any number of secondary, tertiary…
managers (`access_group_managers.rank` 1, 2, 3…). A manager sees every employee
in every group they are attached to, at any rank. Super users need no group.

This round lets Saul create groups and attach managers and employees by hand.
Filling the groups from Monday is the next round.

## 1. `src/app/pages/admin/AdminAccessHub.tsx`

Import `GroupsTab` from `@/app/pages/admin/access/GroupsTab` and replace the
placeholder `<div …>Groups are added in the next update.</div>` with
`<GroupsTab />`. Change nothing else.

## 2. `src/app/pages/admin/access/GroupsTab.tsx` — loads, writes, layout

Loaders and mutators (params flat, never `{ params: … }`):

```tsx
const [groups,     gLoading, gError, reloadGroups]     = useLoadAction(loadAccessGroupsAction,        [] as GroupRow[]);
const [members,    ,         ,       reloadMembers]    = useLoadAction(loadAccessGroupMembersAction,  [] as MemberRow[]);
const [unassigned, ,         ,       reloadUnassigned] = useLoadAction(loadUnassignedEmployeesAction, [] as UnassignedRow[]);
const [users,      ,         ,       reloadUsers]      = useLoadAction(loadAppUsersAction,            [] as UserRow[]);
const [allEmps]                                        = useLoadAction(loadAllEmployeesAction,        [] as EmpRow[]);
const [upsertGroup]   = useMutateAction(upsertAccessGroupAction);
const [deleteGroup]   = useMutateAction(deleteAccessGroupAction);
const [addMember]     = useMutateAction(upsertAccessGroupMemberAction);
const [removeMember]  = useMutateAction(deleteAccessGroupMemberAction);
const [setManager]    = useMutateAction(upsertAccessGroupManagerAction);
const [removeManager] = useMutateAction(deleteAccessGroupManagerAction);
const reloadAll = async () => { await Promise.all([reloadGroups(), reloadMembers(), reloadUnassigned(), reloadUsers()]); };
```

Types:
- `GroupRow = { id: number | string; name: string; notes: string; member_count: number; managers: { user_id: number | string; email: string; display_name: string; rank: number }[] }`
  (`managers` may arrive as a JSON string — if `typeof === 'string'`, `JSON.parse` it).
- `MemberRow = { group_id: number | string; employee_id: number | string; display_name: string; teramind_email: string; active: boolean; monday_manager: string }`
- `UnassignedRow = { employee_id: number | string; display_name: string; teramind_email: string; monday_manager: string }`
- `UserRow` as in `UsersTab.tsx`. `EmpRow = { id: number | string; display_name: string; active: boolean }` (from `loadAllEmployees`).

**Compare every id as `String(id)`** — BIGINTs can arrive as numbers or strings.

Layout, top to bottom:

1. **Toolbar**: search box (matches group name, a manager's name or email, or a
   member's name, case-insensitive); summary "{groups} groups · {assigned}
   employees in groups · {unassigned} not in any group"; **Add group** button
   that reveals an inline name input with Save / Cancel. Save calls
   `upsertGroup({ id: null, name: name.trim(), notes: null })`, then `reloadAll()`.
   If no group with that name exists after reload, show "A group with that name
   already exists." in red.
2. **Not in any group** card, shown only when `unassigned.length > 0`:
   amber border and background, title "Active employees in no group ({n}) —
   no manager can see them". Body: wrapped chips, each "display_name" with the
   Monday manager in grey after it (omit when blank). A chevron collapses it;
   open by default.
3. **Groups grid**: `grid gap-4 md:grid-cols-2 xl:grid-cols-3`, one `GroupCard`
   per filtered group. Empty state: "No groups yet. Add one, or build them from
   Monday (coming next)."

Props passed to each card:
- `group`, `members` = members whose `String(group_id) === String(group.id)`
- `managerOptions` = users with `role === 'manager' && active`
- `employeeOptions` = `allEmps` with `active === true`
- handlers, each awaiting the mutation then `reloadAll()`:
  `onRename(name)` → `upsertGroup({ id: group.id, name, notes: group.notes || null })`;
  `onDelete()` → `deleteGroup({ id: group.id })`;
  `onSetManager(userId, rank)` → `setManager({ group_id: group.id, user_id: userId, rank })`;
  `onRemoveManager(userId)` → `removeManager({ group_id: group.id, user_id: userId })`;
  `onAddMember(employeeId)` → `addMember({ group_id: group.id, employee_id: employeeId })`;
  `onRemoveMember(employeeId)` → `removeMember({ group_id: group.id, employee_id: employeeId })`.

Loading: spinner. Error on groups: red text and Retry (`reloadAll`).

## 3. `src/app/pages/admin/access/GroupCard.tsx` — props only, no loaders

A white rounded card with a thin slate border. No `useLoadAction` or
`useMutateAction` in this file.

**Header**: group name (pencil icon → inline input, Enter saves via `onRename`,
Escape cancels); a grey pill "{members.length} employees"; a delete icon
(`Trash2`) with `window.confirm(\`Delete group "${group.name}"? Its managers stop seeing these ${members.length} employees. No employee or user is deleted.\`)`.

**Managers** (small uppercase label "Managers"):
- Sorted by rank. Each line: rank label (1 **Primary**, 2 **Secondary**,
  3 **Tertiary**, otherwise `#n`), name, email in grey, a small native `<select>`
  with ranks 1–5 that calls `onSetManager(user_id, newRank)`, and an `X` remove
  button calling `onRemoveManager(user_id)`.
- Empty: amber text "No manager — only super users see this group."
- Add row: native `<select>` of `managerOptions` not already on the card
  ("name — email"), and **Add** which calls
  `onSetManager(selectedUserId, maxRank + 1)` (1 when the card has none). If
  `managerOptions` is empty, show grey text "Add managers on the Users tab first."

**Employees** (label "Employees"):
- Sorted by name. Each line: name, a grey "inactive" tag when `active` is false,
  and an `X` calling `onRemoveMember(employee_id)`. Show the first 8, then a
  "Show all {n}" / "Show fewer" toggle.
- Add row: native `<select>` of `employeeOptions` not already in the group,
  sorted by name, and **Add** calling `onAddMember(selectedId)`.

Disable buttons while their handler is running. Use `Pencil`, `Trash2`, `X`,
`Plus`, `ChevronDown`, `ChevronRight`, `Loader2` from `lucide-react` as needed
and `Button` from `@/components/ui/button`.

Keep each file under 12 KB.

## Acceptance

1. Lint clean. Report the byte size of each new or changed file.
2. On `/dev` Admin > Access > Groups shows the "Active employees in no group"
   card listing every active employee, and the empty-groups message.
3. Then confirm every identifier used in each file is imported — every action
   import, `useState`, `useMemo`, and every `lucide-react` icon used.

Do not build anything else. Do not offer to build the Monday import.
