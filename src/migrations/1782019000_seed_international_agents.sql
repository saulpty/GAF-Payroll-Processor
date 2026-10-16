-- International Intake 1 agents (managers Marcela Gordon, Yankel Raskin; 2026-10-16). Insert-only, safe to run twice.
-- country is not Panama, so payroll, PTO and Contracts never load them. Schedule: Standard (9-5 ET, Mon-Fri).
INSERT INTO employees (display_name, teramind_email, company_domain, schedule_id,
                       is_grace_list, excluded_from_payroll, active, notes, role, manager, country)
SELECT v.name, lower(v.email), split_part(lower(v.email), '@', 2),
       (SELECT id FROM schedules WHERE schedule_name = 'Standard'),
       false, false, true, 'International agent (seed 2026-10-16)', 'Intake 1', 'Marcela Gordon', 'International'
FROM (VALUES
  ('Anna Lubemba',      'Anna.L@passiontocarehc.com'),
  ('Lee Ndlvu',         'Lee.N@passiontocarehc.com'),
  ('Sam Mdiza',         'Sam.M@passiontocarehc.com'),
  ('Saeed Rassoull',    'Ibn-Saeed.R@passiontocarehc.com'),
  ('Lisa Mlangeni',     'Lisa.M@passiontocarehc.com'),
  ('Pumi Bunjwa',       'Pumi.B@mombaoh.com'),
  ('Reesie Richardson', 'Richadria.R@mombaoh.com'),
  ('Shmuli Lavner',     'Shmuli.L@mombaoh.com'),
  ('Caitlin Fry',       'Caitlin.F@mombaoh.com'),
  ('Stacey Ndeble',     'Stacey.N@mombaoh.com'),
  ('Angela Phulula',    'Angela.p@passiontocarehc.com'),
  ('Bekki Cooper',      'Bekki.C@passiontocarehc.com'),
  ('Canicia Pauwels',   'Canicia.P@passiontocarehc.com'),
  ('Dee Sweating',      'Damira.S@passiontocarehc.com'),
  ('Riley Molostane',   'Riley.M@passiontocarehc.com'),
  ('Malcolm Mooka',     'Malcolm.M@mombami.com')
) AS v(name, email)
ON CONFLICT (teramind_email) DO NOTHING;

-- ROLLBACK
-- DELETE FROM employees WHERE notes = 'International agent (seed 2026-10-16)'
--   AND NOT EXISTS (SELECT 1 FROM teramind_sessions s WHERE s.employee_id = employees.id);
