# Read-only: which column is the real State — `lookup_mktc2x46` or `color_mkpt5gk4`?

**This is a question, not a change. Do not edit, create or delete any file.**
**Do not write a migration and do not change `classification_config`.**
Report results as tables.

Saul reports that on the Employee Onboarding board, Johann Morante **does** have
a State, in column **`color_mkpt5gk4`**. We read State from
`monday_col_onboarding_state` = **`lookup_mktc2x46`**, which is a *mirror*
column, and it comes back empty for him. He has just re-synced.

`syncContracts.ts` requests only five columns, so `color_mkpt5gk4` has never
been fetched and is not in our stored `raw`. It has to be read from Monday.

## Query 1 — did the re-sync change anything?

```sql
SELECT count(*)                                                   AS live_rows,
       max(synced_at)::text                                       AS newest_sync,
       count(*) FILTER (WHERE state IS NULL OR TRIM(state) = '')  AS blank_state,
       (SELECT COALESCE(NULLIF(TRIM(state), ''), '(blank)')
          FROM monday_contracts
         WHERE employee_name_raw ILIKE '%Morante%'
           AND deleted_on_monday = false
         LIMIT 1)                                                 AS johann_state
FROM monday_contracts
WHERE deleted_on_monday = false;
```

## Query 2 — ask Monday for BOTH columns

Use the existing `pullMondayBoard` action, exactly as `mondaySync.ts` does —
**pass the entire GraphQL query as the single `query` parameter.** Never place
`{{params.…}}` inside a quoted string; that is what broke the Directory sync on
2026-08-11.

Read board `8661565945`, and for every item return both column ids. Remember
that **mirror columns carry their readable value in `display_value`, not
`text`**, and status/colour columns carry theirs in `text` (or `label`). Request
whatever fields each type needs to yield a human-readable value.

Report, for **all** items:

**(a) A coverage comparison:**

| | `lookup_mktc2x46` (mirror, what we read) | `color_mkpt5gk4` (what Saul sees) |
|---|---|---|
| items with a non-empty value | ? | ? |
| items blank | ? | ? |

**(b) Every item where the two columns disagree** — including where one is
blank and the other is not. Show item name, both values.

**(c) Johann Morante's row specifically**, both columns.

## What this decides

- If `color_mkpt5gk4` is populated for all 45 and agrees with the mirror
  wherever the mirror has a value, then **`color_mkpt5gk4` is the correct
  source** and our config points at the wrong column. That is the same defect as
  `BACKLOG.md` #3, where config held a column *type* instead of an id.
- If the two disagree in substance for several people, they are **different
  facts** with different meanings, and we need Saul to say which one the
  Contracts page should show before anything changes.

State plainly which of those two the evidence supports. **Change nothing.**
