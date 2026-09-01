-- 1781990000_update_onboarding_state_col_to_color.sql
--
-- Change: point monday_col_onboarding_state at color_mkpt5gk4 (the status
-- column Saul maintains States in on the Employee Onboarding board) instead of
-- lookup_mktc2x46 (a mirror column that was only as fresh as the last manual
-- link update on Monday).
--
-- After this migration, re-running the Contracts sync will populate state from
-- the status column. colText() in mondaySync.ts reads display_value ?? text,
-- which works for both mirror and status column types.
--
-- Rollback (one step): set value back to 'lookup_mktc2x46'
--   UPDATE classification_config
--   SET value = 'lookup_mktc2x46', updated_at = NOW()
--   WHERE key = 'monday_col_onboarding_state';

UPDATE classification_config
SET value       = 'color_mkpt5gk4',
    description = 'Onboarding: State. Status column on the Onboarding board, '
                  'the column States are maintained in. Replaced the mirror '
                  'lookup_mktc2x46 on 2026-09-01, which was only as fresh as '
                  'the last manual sync.',
    updated_at  = NOW()
WHERE key = 'monday_col_onboarding_state';
