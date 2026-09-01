# ROLL BACK: put `monday_col_onboarding_state` back to `lookup_mktc2x46`

**Create exactly one new migration file under `src/migrations/`.**
**No other file may be created, modified or deleted.** Do not touch
`syncContracts.ts`, any page, or any action. Do not run a sync.

## What happened

The previous migration pointed `monday_col_onboarding_state` at
`color_mkpt5gk4`. I then re-synced the Contracts board and measured the result:

**All 45 employees now have a blank State.** Every single one. Before the
switch, 44 of 45 had a value (Vitasya 16, GA 8, IN 5, GA West 4, GA East 4,
PA 3, AZ 2, OH 1, GAF 1).

`color_mkpt5gk4` returns nothing through the Monday API for any item — neither
`text` nor `display_value`. Whatever renders in the board UI, that column id
does not yield a readable value to us. The mirror `lookup_mktc2x46` was the
working source.

This is the same failure as `BACKLOG.md` #3, where pointing config at a
"corrected" column would have silently blanked the field for everyone.

## The change

```sql
UPDATE classification_config
SET value       = 'lookup_mktc2x46',
    description = 'Onboarding: State. Mirror column - read display_value, not '
                  'text. Reverted here on 2026-09-01 after color_mkpt5gk4 was '
                  'tried and returned an empty value for all 45 items, blanking '
                  'State for every employee. Only as fresh as the last manual '
                  'Contracts sync.',
    updated_at  = NOW()
WHERE key = 'monday_col_onboarding_state';
```

Header comment must record that this reverts the previous migration and why —
measured, all 45 blank — so nobody retries the same switch.

## Acceptance

- One new migration file, nothing else changed.
- Applied to the live database. Report the row back:

```sql
SELECT key, value FROM classification_config
WHERE key = 'monday_col_onboarding_state';
```

- `value` must read `lookup_mktc2x46`.
- **Do not run the Contracts sync.** I will run it and confirm States return.
