# Read-only, corrected: Johann Morante's blank State

**This is a question, not a change. Do not edit, create or delete any file.**
Run both queries against `GAF Planilla DB` and report each as a table.

Correcting my own previous query. Prompt 08 selected `cv->>'text'` and
`cv->>'value'` for the mirror column and got null for *everyone*, including
people whose State is populated — so it proved nothing. `colText` in
`mondaySync.ts` reads **`display_value ?? text`**, precisely because mirror
columns always return `text: null`. The value lives in `display_value`, which I
never looked at.

## Query 1 — the field that actually carries the value

```sql
SELECT mc.employee_name_raw,
       COALESCE(NULLIF(TRIM(mc.state), ''), '(blank)') AS stored_state,
       COALESCE(cv->>'text', '(null)')          AS raw_text,
       COALESCE(cv->>'display_value', '(null)') AS raw_display_value
FROM monday_contracts mc,
     jsonb_array_elements(mc.raw->'column_values') cv
WHERE mc.deleted_on_monday = false
  AND cv->>'id' = 'lookup_mktc2x46'
  AND (mc.employee_name_raw ILIKE '%Morante%'
       OR mc.employee_name_raw ILIKE '%Hees%'
       OR mc.employee_name_raw ILIKE '%Aloma%')
ORDER BY mc.employee_name_raw;
```

If Ulla and Carlos show a `raw_display_value` and Johann shows `(null)` or an
empty string, the value is genuinely absent on the board for him.

## Query 2 — how stale is this mirror?

Johann's row was synced `2026-08-19`. He started `2026-08-03`. If his State was
filled in on the board after the last sync, we would not have it.

```sql
SELECT count(*)                    AS live_rows,
       min(synced_at)::text        AS oldest_sync,
       max(synced_at)::text        AS newest_sync,
       (SELECT last_synced_at::text FROM monday_sync_log WHERE board_key = 'contracts') AS sync_log_contracts,
       (SELECT item_count           FROM monday_sync_log WHERE board_key = 'contracts') AS sync_log_items
FROM monday_contracts
WHERE deleted_on_monday = false;
```

Report both results. Say plainly which explanation the evidence supports:
**(a)** the State is empty on the Onboarding board for Johann, or **(b)** our
mirror is stale and the board has since been filled in. **Do not change any
file, and do not run a sync.**
