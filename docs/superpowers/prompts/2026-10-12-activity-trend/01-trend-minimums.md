# Activity trend: four settings for "how much is a real change"

**Copy the SQL exactly.** Create exactly one new migration file,
`src/migrations/<next>_activity_trend_minimums.sql`, with the SQL below, and run it. **No other
file may be touched** (other than `src/migrations/applied.txt`, which records the run). Do not
edit any `.ts` / `.tsx` file.

## Why
Saul (2026-10-12): the Activity tab will compare the selected dates with the period right before
them. A number only counts as changed when it moves past a minimum. Like every other
classification setting, the minimums live in `classification_config`, never in the page.

## Migration SQL

```sql
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
```

## After running, report
The result of
`SELECT key, value FROM classification_config WHERE key LIKE 'activity_trend_min_%' ORDER BY key;`
— four rows: 30, 2, 10, 5.

## Acceptance
Nothing visible changes. The four rows exist.
