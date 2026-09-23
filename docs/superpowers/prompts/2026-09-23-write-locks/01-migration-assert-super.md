# 01 — A database-side lock: only an active super user may change data

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may be created. No other file may be touched.**

- `src/migrations/1782013000_assert_super.sql` — NEW, content below, character for character. **Apply it.**

Do not edit any action, page or lib in this round. Do not run any action.

## Why

Every action that changes data is protected today only by the app hiding pages and buttons from
managers. Nothing in the database checks who is asking. This function is the check; the next
rounds add it to every change-data action. It raises a clear error — it never silently does
nothing — so a refused save is visible, not lost.

The signed-in person comes from `{{ user.email }}`, which UI Bakery fills in on the server; the
browser cannot choose it.

## `src/migrations/1782013000_assert_super.sql`

```sql
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
```

## Acceptance

- The migration applies cleanly, and a second time without error.
- In the query runner: `SELECT public.assert_super('saul.f@vitasyahc.com');` returns `true`, and
  `SELECT public.assert_super('nobody@example.com');` fails with
  `Only an active super user can change this (signed in as nobody@example.com)`.
- `src/migrations/1782013000_assert_super.sql` is the only new file; nothing else changed.
