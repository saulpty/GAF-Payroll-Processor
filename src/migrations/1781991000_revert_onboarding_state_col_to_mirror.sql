-- 1781991000_revert_onboarding_state_col_to_mirror.sql
--
-- Reverts 1781990000_update_onboarding_state_col_to_color.sql.
--
-- On 2026-09-01 we pointed monday_col_onboarding_state at color_mkpt5gk4
-- (a status column Saul said should carry States). After re-syncing the
-- Contracts board all 45 employees had a blank State — color_mkpt5gk4 returns
-- neither text nor display_value through the Monday API for any item.
-- Whatever renders in the board UI is not accessible via API for that column.
--
-- lookup_mktc2x46 is the working source (mirror column; value is in
-- display_value, not text). Before the switch 44 of 45 employees had a value
-- (Vitasya 16, GA 8, IN 5, GA West 4, GA East 4, PA 3, AZ 2, OH 1, GAF 1).
--
-- Do NOT attempt to switch to color_mkpt5gk4 again without first verifying
-- the column returns a readable value via the API — it does not as of today.
--
-- Rollback of this rollback (if needed):
--   UPDATE classification_config
--   SET value = 'color_mkpt5gk4', updated_at = NOW()
--   WHERE key = 'monday_col_onboarding_state';

UPDATE classification_config
SET value       = 'lookup_mktc2x46',
    description = 'Onboarding: State. Mirror column - read display_value, not text. '
                  'Reverted 2026-09-01 after color_mkpt5gk4 was tried and returned '
                  'an empty value for all 45 items, blanking State for every employee. '
                  'Only as fresh as the last manual Contracts sync.',
    updated_at  = NOW()
WHERE key = 'monday_col_onboarding_state';
