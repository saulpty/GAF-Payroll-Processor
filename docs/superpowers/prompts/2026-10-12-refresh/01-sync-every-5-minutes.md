# Automatic data refresh: every 5 minutes instead of 15

**Copy the SQL exactly.** Create exactly one new migration file,
`src/migrations/<next>_sync_every_5_minutes.sql`, with the SQL below, and run it. **No other
file may be touched** (other than `src/migrations/applied.txt`, which records the run). Do not
edit any `.ts` / `.tsx` file: the three background syncs already read this setting and already
accept 5 as the minimum.

## Why
Saul (2026-10-12): the Hub's saved copies of Monday and Teramind data should refresh every
5 minutes while a super user has it open, not every 15. The interval is the
`classification_config` row `sync_every_minutes`; it is not shown on the Rules & Config page,
so it is changed here.

## Migration SQL

```sql
-- Saul, 2026-10-12: background refresh every 5 minutes instead of 15.
-- Only touches the row if it still holds the seeded 15.

UPDATE classification_config
SET value = '5',
    updated_at = NOW()
WHERE key = 'sync_every_minutes'
  AND value = '15';

-- ROLLBACK
-- UPDATE classification_config SET value = '15', updated_at = NOW() WHERE key = 'sync_every_minutes' AND value = '5';
```

## After running, report
The result of `SELECT key, value FROM classification_config WHERE key = 'sync_every_minutes';`
— it must read `5`.

## Acceptance
Admin → Employees → Monday tab: the grey line under the four cards reads
**Data Updates Every 5 Minutes** (it read "Every 15 Minutes" before).
