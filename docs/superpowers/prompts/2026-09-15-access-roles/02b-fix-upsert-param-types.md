# 02b — Fix: saving a user fails with "Can't execute upsertAppUser action: Unknown error"

## Files that may change

- `src/actions/upsertAppUser.ts`
- `src/actions/upsertAccessGroup.ts`

No other file may be touched.

## What happened

On `/dev`, Admin > Access > Users > **Add user** with a valid email and **Save**
shows `Can't execute upsertAppUser action: Unknown error`. Nothing is saved.

Both actions are a `WITH upd AS (UPDATE …) INSERT … SELECT … WHERE NOT EXISTS …`.
In the `INSERT … SELECT` list, bare parameters such as `{{params.role}}` and
`{{params.notes}}` have **no type**: they are not compared to a column, so
Postgres cannot infer one ("could not determine data type of parameter"),
which UI Bakery reports as "Unknown error". `loadCurrentViewer`, which casts its
parameter (`{{params.viewAs}}::text`), works.

## The change

In both files, give **every** `{{params.x}}` an explicit cast, everywhere it
appears (UPDATE part and INSERT part):

- `upsertAppUser.ts`: `{{params.email}}::text`, `{{params.display_name}}::text`,
  `{{params.role}}::text`, `{{params.notes}}::text`. Keep the existing
  `::boolean` and `::bigint` casts.
- `upsertAccessGroup.ts`: `{{params.name}}::text`, `{{params.notes}}::text`.
  Keep `::bigint`.

Change nothing else: same CTE, same `ON CONFLICT`, same columns.
`{{params.x}}` is never inside quotes.

## Acceptance

1. Lint clean.
2. Show the final SQL of both files in your reply.
3. Do not run the actions (writes are blocked for you). Saul's side tests them
   on `/dev`.

Do not build anything else.
