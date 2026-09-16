-- One row per (employee, manager) from the access groups, with the manager's rank.
-- Used by the global Manager filter. Rollback: DROP VIEW v_employee_managers;
CREATE OR REPLACE VIEW v_employee_managers AS
  SELECT m.employee_id,
         gm.rank,
         u.email AS manager_email,
         COALESCE(NULLIF(btrim(u.display_name), ''), u.email) AS manager_name
    FROM access_group_members m
    JOIN access_group_managers gm ON gm.group_id = m.group_id
    JOIN app_users u ON u.id = gm.user_id
   WHERE u.active;
