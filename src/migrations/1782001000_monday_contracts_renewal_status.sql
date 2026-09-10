-- 2026-09-10. Add renewal_status column to monday_contracts and register the
-- Onboarding board renewal status column id in classification_config.
-- Rollback: DELETE FROM classification_config WHERE key = 'monday_col_onboarding_renewal'; ALTER TABLE monday_contracts DROP COLUMN renewal_status;

ALTER TABLE monday_contracts ADD COLUMN IF NOT EXISTS renewal_status TEXT;

INSERT INTO classification_config (key, value, label, description, value_type, category) VALUES
  ('monday_col_onboarding_renewal', 'color_mktdvagn', 'Onboarding: Renewal status',
   'Status column on the Onboarding board where Saul records contract renewals: Passed = renewed, Failed = not renewed, anything else = pending review.',
   'text', 'monday_columns')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, label = EXCLUDED.label, description = EXCLUDED.description,
      value_type = EXCLUDED.value_type, category = EXCLUDED.category, updated_at = NOW();
