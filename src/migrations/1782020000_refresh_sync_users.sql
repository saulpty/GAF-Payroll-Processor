-- Saul, 2026-10-20: named managers may refresh the saved Monday / Teramind data copies.
-- Adds app_users.can_refresh_sync (default false), ticks it for two people, and adds
-- public.assert_sync_writer: an active super user, or an active user with the flag.
-- Deletes nothing. Safe to run twice.

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS can_refresh_sync BOOLEAN NOT NULL DEFAULT false;

UPDATE app_users
SET can_refresh_sync = true,
    updated_at = NOW()
WHERE email IN ('arelis.a@vitasyahc.com', 'marcela.g@vitasyahc.com');

CREATE OR REPLACE FUNCTION public.assert_sync_writer(caller_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $f$
BEGIN
  IF caller_email IS NULL OR btrim(caller_email) = '' OR NOT EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.email = lower(btrim(caller_email))
      AND u.active
      AND (u.role = 'super_user' OR u.can_refresh_sync)
  ) THEN
    RAISE EXCEPTION 'Only a super user or a user allowed to refresh data can change this (signed in as %)',
      coalesce(nullif(btrim(caller_email), ''), 'nobody')
      USING ERRCODE = '42501';
  END IF;
  RETURN true;
END
$f$;

-- ROLLBACK
-- DROP FUNCTION IF EXISTS public.assert_sync_writer(text);
-- ALTER TABLE app_users DROP COLUMN IF EXISTS can_refresh_sync;
