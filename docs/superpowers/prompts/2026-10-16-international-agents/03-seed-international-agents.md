# Add the international Intake 1 agents (data migration)

> Teramind checked 2026-10-16: all 16 are on Teramind and every email below matches Teramind exactly.
> Names are the ones Marcela and Yankel sent (Saul, 2026-10-16: emails are what matter). The same 16
> rows are on the Monday International Employee Directory, Current Employees.

**Copy every edit exactly, character for character.**

Why a migration and not the sync: the international sync (next prompt) refuses to create more than 3 new employees in
one run (a safety brake). This adds the first group once; after that the International Directory
board keeps them up to date (active, role, manager, country).

**Only this file may change:** new `src/migrations/1782019000_seed_international_agents.sql` and
its line in `applied.txt`. **No other file may be touched.** Untouchable files as usual.

```sql
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
```

Reply with: `SELECT display_name, teramind_email, country, schedule_id FROM employees WHERE country <> 'Panama' ORDER BY 1;`
(expect the rows above, none with a null schedule_id).

Open point for review: `ON CONFLICT DO NOTHING` means anyone whose email already exists is left
as-is (Saul says none of them are in the app; the reply query proves it).
