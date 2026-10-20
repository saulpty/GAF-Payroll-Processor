# Let two named managers' Refresh button save fresh Monday / Teramind data (database part)

**Copy the SQL exactly.** Create exactly one new migration file,
`src/migrations/1782020000_refresh_sync_users.sql`, with the SQL below, and run it. **No other
file may be touched** (other than `src/migrations/applied.txt`, which records the run). Do not
edit any `.ts` / `.tsx` file in this step. Do not change `public.assert_super`.

## Why
Saul (2026-10-20): Arelis Acosta and Marcela need their top-bar Refresh button to pull fresh
data from Monday and Teramind, as it does for a super user. Today every save action is locked
by `public.assert_super`, so their Refresh can only re-read what is already saved.

This step adds a per-user flag and a second, narrower lock. The next prompt switches only the
11 actions that save the Monday requests / attendance forms / contracts copies and the
Teramind punch copy to the new lock. Everything else (employees, access groups, payroll, admin)
stays super-user only.

## Migration SQL

```sql
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
```

## After running, report
The result of
`SELECT email, role, active, can_refresh_sync FROM app_users WHERE can_refresh_sync ORDER BY email;`
— it must list exactly `arelis.a@vitasyahc.com` and `marcela.g@vitasyahc.com`, both active.
If either is missing, say so; do not guess another email.
