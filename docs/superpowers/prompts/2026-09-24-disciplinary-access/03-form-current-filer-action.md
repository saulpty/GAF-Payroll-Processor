# 03 (F2) — New action `loadCurrentFiler`: who is signed in, and are they an admin

> **⚠ This prompt goes into the 'GAF Disciplinary Actions Form' app (PC3PsXDDa9), NOT the GAF Panama HR Hub. Check the project name in the builder before pasting.**

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may be created. No other file may be touched.**

- `src/actions/loadCurrentFiler.ts` — NEW, content below.

Do not use it anywhere yet (the next prompts wire it in). Do not edit any page, hook, util,
other action or migration.

## Why

The person filing a warning must be the signed-in user, not a name someone types.
`{{ user.email }}` is filled in by UI Bakery **on the server** from the login, so the browser
cannot fake it. The HR Hub already relies on exactly this (`lower(btrim({{ user.email }}::text))`).

## `src/actions/loadCurrentFiler.ts`

```ts
import { action } from '@uibakery/data';

// Who is filing: the signed-in UI Bakery user (never a typed value), and whether
// they are in disciplinary_admins (admins may file for every current employee).
// Always returns exactly one row.
function loadCurrentFiler() {
  return action('loadCurrentFiler', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      WITH me AS (
        SELECT lower(btrim(coalesce({{ user.email }}::text, ''))) AS email
      )
      SELECT me.email,
             (a.email IS NOT NULL) AS is_admin,
             a.name                AS admin_name
        FROM me
        LEFT JOIN disciplinary_admins a ON a.email = me.email;
    `,
  });
}

export default loadCurrentFiler;
```

Rules:
- `{{ user.email }}` stands alone, cast with `::text`. Never inside quotes.
- The action takes **no params**. Callers use `useLoadAction(loadCurrentFilerAction, [], {})`.

## Acceptance

1. Running the action while signed in as Saul returns one row:
   `email = saul.f@vitasyahc.com`, `is_admin = true`, `admin_name = Saul Fallembaum`.
2. The email is lower-case and has no spaces, whatever case the login uses.
3. **If `email` comes back empty**, stop and say so in your report — it would mean this app
   does not know who is signed in, and the next prompts depend on it.
4. `src/actions/loadCurrentFiler.ts` is the only new file; nothing else changed.

## Report back

List every file you created, changed or deleted, and paste the row the action returned.
