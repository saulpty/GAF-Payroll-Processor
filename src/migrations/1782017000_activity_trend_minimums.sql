-- Activity trend minimums (Saul, 2026-10-12). Insert-only; safe to run twice.

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_active_minutes', '30', 'Average Active Time Must Move By',
  'Minutes the average active time must change between the two periods before the Activity trend counts it.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_entry_minutes', '10', 'Average Entry Must Move By',
  'Minutes the average entry time must change between the two periods before the Activity trend counts it.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_days', '2', 'Low or Missed Days Must Move By',
  'Days the count of low-activity days, or of missed days, must change before the Activity trend counts it.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

INSERT INTO classification_config (key, value, label, description, value_type, category)
VALUES ('activity_trend_min_worked_days', '5', 'Days With Work Needed to Compare',
  'Fewer days with work than this in either period shows Not enough data instead of a trend.',
  'number', 'teramind')
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK
-- Remove the four rows whose key starts with activity_trend_min_ by hand if this is ever undone.
