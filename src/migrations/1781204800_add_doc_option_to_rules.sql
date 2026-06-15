-- Add default_doc_option to event_type_rules so a rule can specify a complete default state
ALTER TABLE event_type_rules ADD COLUMN IF NOT EXISTS default_doc_option TEXT;
