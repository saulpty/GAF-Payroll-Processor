# 06 — A partial Monday pull must throw, never quietly mark everything deleted

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may change. No other file may be touched.**

- `src/app/pages/admin/employees/mondaySync.ts`

Do not create files. Do not touch any page, action, migration or other lib. Do not reformat
anything you are not asked to change. Do not rename or remove any existing export.

## The bug

Monday's GraphQL API returns HTTP 200 even when a query fails — the body is
`{ errors: [...] }` with no `data`. `pullAllItems` only checks this on the *first* page:

```ts
const raw = await pull({ query: firstQuery, variables: {} });
const firstPage = (raw as any)?.data?.boards?.[0]?.items_page as PageResult | undefined;
if (!firstPage) throw new Error('Monday returned no items_page for board ' + boardId);
```

But on every later page, a missing `next_items_page` is treated as "no more pages" instead of
"the request failed":

```ts
    const nextRaw = await pull({ query: nextQuery, variables: {} });
    const nextPage = (nextRaw as any)?.data?.next_items_page as PageResult | undefined;
    if (!nextPage) break;
```

Attendance Forms alone has 1,196+ items, so a 500-per-page pull is routinely 3+ pages — a
transient error or a complexity-budget rejection on page 2 or 3 is silently swallowed and
`pullAllItems` returns a truncated list as if it were complete.

That truncated list then reaches `batchUpsert`, which calls `markDeleted` with whatever
`seenIds` it was given, no matter how short:

```ts
export async function batchUpsert(
  rows: Record<string, unknown>[],
  seenIds: string[],
  upsert: UpsertFn,
  markDeleted: DeletedFn,
): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    await upsert({ rows: JSON.stringify(rows.slice(i, i + BATCH)) });
  }
  await markDeleted({ seen_ids: JSON.stringify(seenIds) });
}
```

The three `updateMonday*Deleted` actions this feeds have no `WHERE` clause narrowing them to
the seen ids — they flag every row *not* in `seen_ids` as `deleted_on_monday = true`. A
truncated pull after page 1 flags every item on the unread pages deleted. An empty `seenIds`
(pull failed before any page loaded, or a board came back with zero items) flags the *entire
table* deleted.

## Why this is safe to throw on

`pullAllItems` and `batchUpsert` are called from `syncRequests.ts`, `syncAttendanceForms.ts`,
`syncContracts.ts` and `syncDirectory.ts` with no local `try/catch` — a thrown error already
propagates out of each `syncX()` call today. Both call sites that invoke `syncX()` already
catch it:

- `MondaySyncCard.tsx` (`handleSync`) wraps `await onSync()` in `try/catch`, sets the card's
  error banner, and writes `last_error` to `monday_sync_log` — it does not crash the page.
- `MondayAutoSync.tsx` wraps each board's sync in `try/catch` inside its per-board loop,
  logs a `console.warn`, records `errMsg` to `sync_log` and `monday_sync_log`, and continues
  to the next board.

So making a partial pull throw does not introduce a new failure mode — it routes the failure
into the error handling that already exists, instead of into `markDeleted` silently corrupting
the table.

## 1. `pullAllItems` — a missing later page is a thrown error, not a stop

Replace:

```ts
    const nextRaw = await pull({ query: nextQuery, variables: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextPage = (nextRaw as any)?.data?.next_items_page as PageResult | undefined;
    if (!nextPage) break;
```

with:

```ts
    const nextRaw = await pull({ query: nextQuery, variables: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextPage = (nextRaw as any)?.data?.next_items_page as PageResult | undefined;
    if (!nextPage) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (nextRaw as any)?.errors?.[0]?.message;
      throw new Error(
        'Monday returned no next_items_page for board ' + boardId +
        (msg ? ' (' + msg + ')' : ''),
      );
    }
```

The first-page check already throws when `items_page` is missing — leave it exactly as is.

## 2. `batchUpsert` — never call `markDeleted` with an empty `seenIds`

Replace:

```ts
export async function batchUpsert(
  rows: Record<string, unknown>[],
  seenIds: string[],
  upsert: UpsertFn,
  markDeleted: DeletedFn,
): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    await upsert({ rows: JSON.stringify(rows.slice(i, i + BATCH)) });
  }
  await markDeleted({ seen_ids: JSON.stringify(seenIds) });
}
```

with:

```ts
export async function batchUpsert(
  rows: Record<string, unknown>[],
  seenIds: string[],
  upsert: UpsertFn,
  markDeleted: DeletedFn,
): Promise<void> {
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    await upsert({ rows: JSON.stringify(rows.slice(i, i + BATCH)) });
  }
  // No items seen this run — a board that pulled 0 rows almost certainly failed before
  // producing any, not a board that genuinely emptied out. Never let an empty seenIds
  // flag every existing row deleted_on_monday = true.
  if (seenIds.length === 0) return;
  await markDeleted({ seen_ids: JSON.stringify(seenIds) });
}
```

Nothing else in the file changes.

## Acceptance

- `pullAllItems` with a fake `pull` that returns a valid page 1 (with a `cursor`) followed by
  `{ errors: [{ message: 'Complexity budget exhausted' }] }` on page 2 rejects with an `Error`
  whose message names the board id and includes `'Complexity budget exhausted'`. Today it
  resolves with only page 1's items.
- `pullAllItems` behaviour for a missing `items_page` on the *first* response is unchanged
  (still throws, still names the board).
- `batchUpsert` called with `seenIds: []` still runs any pending `upsert` calls but never
  calls `markDeleted`. Today it always calls `markDeleted({ seen_ids: '[]' })`.
- `batchUpsert` called with a non-empty `seenIds` still calls `markDeleted` exactly once with
  those ids, same as today.
- `src/app/pages/admin/employees/mondaySync.ts` is the only file changed.
