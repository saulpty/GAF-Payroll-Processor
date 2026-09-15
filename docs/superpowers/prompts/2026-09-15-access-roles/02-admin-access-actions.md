# 02 — Twelve actions for the Admin > Access page

## Files that may change (all new)

- `src/actions/loadAppUsers.ts`
- `src/actions/upsertAppUser.ts`
- `src/actions/deleteAppUser.ts`
- `src/actions/loadAccessGroups.ts`
- `src/actions/loadAccessGroupMembers.ts`
- `src/actions/loadUnassignedEmployees.ts`
- `src/actions/upsertAccessGroup.ts`
- `src/actions/deleteAccessGroup.ts`
- `src/actions/upsertAccessGroupMember.ts`
- `src/actions/deleteAccessGroupMember.ts`
- `src/actions/upsertAccessGroupManager.ts`
- `src/actions/deleteAccessGroupManager.ts`

No other file may be touched. No page, no component, no migration.

## Why

The tables from the previous round (`app_users`, `access_groups`,
`access_group_members`, `access_group_managers`) need load and save actions
before the Admin > Access page can be built. This round only adds actions, so
the app looks exactly as before.

These loaders are for an admin page only super users will see, so they take
no `manager` param. This is a deliberate exception to the usual rule.

## Shape of every file

Exactly the shape of `src/actions/loadCurrentViewer.ts`: one
`import { action } from '@uibakery/data'`, one function named like the file,
`action('<fileName>', 'SQL', { datasourceName: 'GAF Planilla DB', query: \`...\` })`,
and `export default`. Parameters are `{{params.x}}`, flat, **never inside
quotes**. The SQL for each file is below; use it verbatim.

### loadAppUsers
```sql
SELECT u.id, u.email, u.display_name, u.role, u.all_employees, u.active,
       COALESCE(u.notes, '') AS notes,
       (SELECT count(*)::int FROM access_group_managers gm WHERE gm.user_id = u.id) AS group_count
  FROM app_users u
 ORDER BY (u.role = 'super_user') DESC, u.display_name, u.email;
```

### upsertAppUser
Updates by `id` when one is given, otherwise inserts (or updates by email).
```sql
WITH upd AS (
  UPDATE app_users
     SET email = lower(btrim({{params.email}})),
         display_name = btrim(COALESCE({{params.display_name}}, '')),
         role = {{params.role}},
         all_employees = COALESCE({{params.all_employees}}::boolean, false),
         active = COALESCE({{params.active}}::boolean, true),
         notes = {{params.notes}},
         updated_at = now()
   WHERE id = {{params.id}}::bigint
  RETURNING id
)
INSERT INTO app_users (email, display_name, role, all_employees, active, notes)
SELECT lower(btrim({{params.email}})), btrim(COALESCE({{params.display_name}}, '')), {{params.role}},
       COALESCE({{params.all_employees}}::boolean, false), COALESCE({{params.active}}::boolean, true), {{params.notes}}
 WHERE NOT EXISTS (SELECT 1 FROM upd)
ON CONFLICT (email) DO UPDATE
   SET display_name = EXCLUDED.display_name, role = EXCLUDED.role,
       all_employees = EXCLUDED.all_employees, active = EXCLUDED.active,
       notes = EXCLUDED.notes, updated_at = now();
```

### deleteAppUser
Refuses to delete yourself or the last active super user.
```sql
DELETE FROM app_users u
 WHERE u.id = {{params.id}}::bigint
   AND u.email <> lower(btrim({{ user.email }}))
   AND NOT (u.role = 'super_user'
            AND (SELECT count(*) FROM app_users WHERE role = 'super_user' AND active) <= 1);
```

### loadAccessGroups
```sql
SELECT g.id, g.name, COALESCE(g.notes, '') AS notes,
       (SELECT count(*)::int FROM access_group_members m WHERE m.group_id = g.id) AS member_count,
       COALESCE((
         SELECT json_agg(json_build_object('user_id', u.id, 'email', u.email,
                                           'display_name', u.display_name, 'rank', gm.rank)
                         ORDER BY gm.rank, u.display_name)
           FROM access_group_managers gm JOIN app_users u ON u.id = gm.user_id
          WHERE gm.group_id = g.id), '[]'::json) AS managers
  FROM access_groups g
 ORDER BY g.name;
```

### loadAccessGroupMembers
All memberships at once (one request for every group card).
```sql
SELECT m.group_id, e.id AS employee_id, e.display_name, e.teramind_email, e.active,
       COALESCE(e.manager, '') AS monday_manager
  FROM access_group_members m
  JOIN employees e ON e.id = m.employee_id
 ORDER BY e.display_name;
```

### loadUnassignedEmployees
```sql
SELECT e.id AS employee_id, e.display_name, e.teramind_email, COALESCE(e.manager, '') AS monday_manager
  FROM employees e
 WHERE e.active = true
   AND COALESCE(e.excluded_from_payroll, false) = false
   AND NOT EXISTS (SELECT 1 FROM access_group_members m WHERE m.employee_id = e.id)
 ORDER BY e.display_name;
```

### upsertAccessGroup
```sql
WITH upd AS (
  UPDATE access_groups SET name = btrim({{params.name}}), notes = {{params.notes}}
   WHERE id = {{params.id}}::bigint
  RETURNING id
)
INSERT INTO access_groups (name, notes)
SELECT btrim({{params.name}}), {{params.notes}}
 WHERE NOT EXISTS (SELECT 1 FROM upd)
ON CONFLICT (name) DO NOTHING;
```

### deleteAccessGroup
```sql
DELETE FROM access_groups WHERE id = {{params.id}}::bigint;
```

### upsertAccessGroupMember
```sql
INSERT INTO access_group_members (group_id, employee_id)
VALUES ({{params.group_id}}::bigint, {{params.employee_id}}::bigint)
ON CONFLICT (group_id, employee_id) DO NOTHING;
```

### deleteAccessGroupMember
```sql
DELETE FROM access_group_members
 WHERE group_id = {{params.group_id}}::bigint AND employee_id = {{params.employee_id}}::bigint;
```

### upsertAccessGroupManager
```sql
INSERT INTO access_group_managers (group_id, user_id, rank)
VALUES ({{params.group_id}}::bigint, {{params.user_id}}::bigint, COALESCE({{params.rank}}::smallint, 1))
ON CONFLICT (group_id, user_id) DO UPDATE SET rank = EXCLUDED.rank;
```

### deleteAccessGroupManager
```sql
DELETE FROM access_group_managers
 WHERE group_id = {{params.group_id}}::bigint AND user_id = {{params.user_id}}::bigint;
```

## Acceptance — run in this order and paste raw results

1. `loadAppUsers` → 2 rows (Saul, Tim).
2. `upsertAccessGroup` `{ id: null, name: 'Probe group', notes: null }`, then
   `loadAccessGroups` → shows `Probe group`; note its id.
3. `upsertAccessGroupManager` `{ group_id: <id>, user_id: <Saul's id>, rank: 1 }`.
4. `loadUnassignedEmployees` → report the count; take the first `employee_id`.
5. `upsertAccessGroupMember` `{ group_id: <id>, employee_id: <that id> }`.
6. `loadAccessGroups` → `Probe group` has `member_count` 1 and one manager.
   `loadAccessGroupMembers` → one row.
7. `deleteAccessGroup` `{ id: <id> }` → `loadAccessGroups` returns 0 rows and
   `loadAccessGroupMembers` returns 0 rows (cascade).
8. `deleteAppUser` with Saul's id → `loadAppUsers` still returns 2 rows
   (you cannot delete yourself).
9. Then confirm every identifier used in each file is imported.

Do not build anything else. Do not offer to build the page.
