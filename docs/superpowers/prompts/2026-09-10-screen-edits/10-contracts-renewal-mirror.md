# 10 — Mirror the Onboarding board's renewal status into `monday_contracts`

Saul renews contracts on the Employee Onboarding board (config key
`monday_board_onboarding`) in a status column whose id is **`color_mktdvagn`**:
*Passed* = renewed, *Failed* = not renewed, anything else = pending review.
Nothing in the app reads it yet.

## Files you may change

- **One new migration** under `src/migrations/`
- `src/app/pages/admin/employees/syncContracts.ts`
- `src/actions/upsertMondayContracts.ts`

**No other file may be touched.** No page, no `tenure.ts`, no
`loadContractMilestones`. **Do not run the Contracts sync** — I will run it and
measure. Never write the column id anywhere except the migration.

## Migration

In the style of the existing ones, with a header comment and a Rollback line:

```sql
ALTER TABLE monday_contracts ADD COLUMN IF NOT EXISTS renewal_status TEXT;

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_col_onboarding_renewal', 'color_mktdvagn', 'Onboarding: Renewal status',
   'Status column on the Onboarding board where Saul records contract renewals: Passed = renewed, Failed = not renewed, anything else = pending review.',
   'text', 'monday_columns')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, label = EXCLUDED.label, description = EXCLUDED.description,
      value_type = EXCLUDED.value_type, category = EXCLUDED.category, updated_at = NOW();
```

Rollback: `DELETE FROM classification_config WHERE key = 'monday_col_onboarding_renewal'; ALTER TABLE monday_contracts DROP COLUMN renewal_status;`

Apply it to the live database and report the config row back.

## syncContracts.ts

Add `'monday_col_onboarding_renewal'` to `KEYS`, pass
`k.monday_col_onboarding_renewal` to `pullAllItems`, and add
`renewal_status: colText(item, k.monday_col_onboarding_renewal),` to each row.
`colText` already reads `display_value ?? text`, which is how a status column's
label comes back.

## upsertMondayContracts.ts

Add `renewal_status` to the column list, `r->>'renewal_status'` in the SELECT,
and `renewal_status = EXCLUDED.renewal_status` in the ON CONFLICT update.

## Verify

- Migration applied; `SELECT key, value FROM classification_config WHERE key = 'monday_col_onboarding_renewal'` returns `color_mktdvagn`.
- Only the three files changed/created. Confirm every identifier used is imported.
