-- Access roles: six more super users, named by Saul on 2026-09-16.
-- Rollback: UPDATE app_users SET role = 'manager' WHERE email IN (...) or DELETE the rows.
INSERT INTO app_users (email, display_name, role, all_employees, active, notes) VALUES
  ('jesse@vitasyahc.com',     'Jesse Hoffman',    'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('stephanie@vitasyahc.com', 'Stephanie Mullis', 'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('matt@vitasyahc.com',      'Matt Sherfield',   'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('leibel.m@vitasyahc.com',  'Leibel Mangel',    'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('monty@vitasyahc.com',     'Monty Druin',      'super_user', false, true, 'Super user named by Saul 2026-09-16'),
  ('alex.l@vitasyahc.com',    'Alex Levinger',    'super_user', false, true, 'Super user named by Saul 2026-09-16')
ON CONFLICT (email) DO UPDATE SET role = 'super_user', active = true, display_name = EXCLUDED.display_name, updated_at = now();
