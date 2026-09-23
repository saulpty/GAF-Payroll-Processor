-- Database-side lock for every change-data action (2026-09-23).
-- Usage in an action:  ... WHERE ... AND public.assert_super({{ user.email }}::text)
-- STABLE so Postgres evaluates it once, before touching any row: a refused caller
-- gets an error even when no row would have matched. Safe to run twice.
CREATE OR REPLACE FUNCTION public.assert_super(caller_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $f$
BEGIN
  IF caller_email IS NULL OR btrim(caller_email) = '' OR NOT EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.email = lower(btrim(caller_email))
      AND u.role = 'super_user'
      AND u.active
  ) THEN
    RAISE EXCEPTION 'Only an active super user can change this (signed in as %)',
      coalesce(nullif(btrim(caller_email), ''), 'nobody')
      USING ERRCODE = '42501';
  END IF;
  RETURN true;
END
$f$;
