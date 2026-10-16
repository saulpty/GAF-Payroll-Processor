-- Gate 1 for the international agents: are the 16 on Teramind, and under which email?
-- READ-ONLY. Run in UIB → Database (GAF Planilla DB) ONLY after the other UIB session is done.
-- teramind_agents is the app's copy of Teramind's WHOLE roster (the API sees every agent, more
-- than Saul's own Teramind login). It refreshes once a day; if a name is missing, press Refresh /
-- Admin → Employees → Teramind → pull the roster first, then re-run.
-- Matching by email AND by surname, because the Teramind email may differ from the list.

WITH wanted(name, email, surname) AS (VALUES
  ('Anna Lubemba',      'anna.l@passiontocarehc.com',      'lubemba'),
  ('Lee Ndlvu',         'lee.n@passiontocarehc.com',       'ndl'),
  ('Sam Mdiza',         'sam.m@passiontocarehc.com',       'mdiza'),
  ('Saeed Rassoull',    'ibn-saeed.r@passiontocarehc.com', 'rassoul'),
  ('Lisa Mlangeni',     'lisa.m@passiontocarehc.com',      'mlangeni'),
  ('Pumi Bunjwa',       'pumi.b@mombaoh.com',              'bunjwa'),
  ('Reesie Richardson', 'richadria.r@mombaoh.com',         'richardson'),
  ('Shmuli Lavner',     'shmuli.l@mombaoh.com',            'lavner'),
  ('Caitlin Fry',       'caitlin.f@mombaoh.com',           'fry'),
  ('Stacey Ndeble',     'stacey.n@mombaoh.com',            'ndeb'),
  ('Angela Phulula',    'angela.p@passiontocarehc.com',    'phulula'),
  ('Bekki Cooper',      'bekki.c@passiontocarehc.com',     'cooper'),
  ('Canicia Pauwels',   'canicia.p@passiontocarehc.com',   'pauwels'),
  ('Dee Sweating',      'damira.s@passiontocarehc.com',    'sweating'),
  ('Riley Molostane',   'riley.m@passiontocarehc.com',     'molostane'),
  ('Malcolm Mooka',     'malcolm.m@mombami.com',           'mooka')
)
SELECT w.name                         AS list_name,
       w.email                        AS list_email,
       ta.agent_id,
       ta.name                        AS teramind_name,
       ta.email                       AS teramind_email,
       ta.deleted,
       (lower(ta.email) = w.email)    AS email_matches,
       ta.employee_id                 AS already_linked_to_employee,
       (SELECT max(s.work_date) FROM teramind_sessions s WHERE s.agent_id = ta.agent_id) AS last_session_saved
FROM wanted w
LEFT JOIN teramind_agents ta
  ON lower(ta.email) = w.email
  OR lower(ta.name) LIKE '%' || w.surname || '%'
ORDER BY w.name;

-- Reading the result:
--  * agent_id empty        → not on Teramind (or roster not refreshed). Ask Marcela/Yankel.
--  * email_matches = false → use teramind_email in prompt 05, not the list email.
--  * two rows for a name   → surname matched someone else (e.g. Cooper, Fry, Richardson): keep the right one.
--  * last_session_saved empty is normal: the app only saves sessions for linked employees.
