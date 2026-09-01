# Point `monday_col_onboarding_state` at `color_mkpt5gk4`

**Create exactly one new migration file under `src/migrations/`.**
**No other file may be created, modified or deleted.** Do not touch
`syncContracts.ts` — it already reads this config key, so no code change is
needed. Do not touch any page, action, or `tenure.ts`. Do not run a sync.

## What to change

`classification_config` key `monday_col_onboarding_state` currently holds
`lookup_mktc2x46`, a mirror column. Saul says the column that should be syncing
States across the Employee Onboarding board is **`color_mkpt5gk4`**.

The migration updates that one row:

```sql
UPDATE classification_config
SET value       = 'color_mkpt5gk4',
    description = 'Onboarding: State. Status column on the Onboarding board, '
                  'the column States are maintained in. Replaced the mirror '
                  'lookup_mktc2x46 on 2026-09-01, which was only as fresh as '
                  'the last manual sync.',
    updated_at  = NOW()
WHERE key = 'monday_col_onboarding_state';
```

Write it in the style of the existing migrations, with a header comment saying
what changed and why, and a **Rollback** line naming the old value
`lookup_mktc2x46` so it can be put back in one step.

Nothing else in `classification_config` may be touched. Do not add keys, do not
delete keys.

## Why this is safe to try

`colText` in `mondaySync.ts` reads `display_value ?? text`, which works for both
mirror and status columns, so the parser needs no change.

**This is deliberately reversible.** After it is applied I will re-sync the
Contracts board and count how many employees end up with a State. If
`color_mkpt5gk4` turns out to be sparser than the mirror, the rollback above
puts it straight back. That measurement is the point — it is the only way to
compare the two columns, because the Monday API cannot be queried read-only from
here.

## Acceptance

- One new migration file, nothing else changed.
- Applied to the live database — confirm it ran, and report the row back:

```sql
SELECT key, value, description
FROM classification_config
WHERE key = 'monday_col_onboarding_state';
```

- `value` must read `color_mkpt5gk4`.
- **Do not run the Contracts sync.** I will run it and measure the result.
