-- Remove config keys that are now hardcoded policy (grace behavior confirmed by business owner)
DELETE FROM classification_config
WHERE key IN ('grace_pardon_requires_form', 'grace_excess_split_event');

-- Rename the engine config panel label to be more human-friendly
UPDATE classification_config
SET label = 'Auto-resolve non-grace tardiness'
WHERE key = 'non_grace_auto_resolve';
