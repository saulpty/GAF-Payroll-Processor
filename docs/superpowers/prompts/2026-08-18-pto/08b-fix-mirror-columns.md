Fix a real defect in the Monday sync: mirror/lookup columns are being read incorrectly, so six fields are silently stored empty.

Files that may be modified: `src/app/pages/admin/employees/mondaySync.ts`, and only if strictly necessary `syncRequests.ts`, `syncAttendanceForms.ts`, `syncContracts.ts`, `syncDirectory.ts`.
No other file may change. Do NOT touch any file under `src/actions/`, any migration, `MondayTab.tsx`, or `MondaySyncCard.tsx` unless the change genuinely cannot be made without it — and if so, say why.

## The defect, measured

Monday returns `text: null` for `mirror` type columns. The human-readable value is in `display_value`, which is only returned if the query asks for it via an inline fragment on `MirrorValue`. Verified in Monday's API playground:

```
{ "id": "email_mkzjqdh7",  "type": "email",  "text": "Danny.E@avondalecaregrouppa.com" }
{ "id": "lookup_mkzhhh4q", "type": "mirror", "text": null, "display_value": "Jessica.C@avondalecaregrouppa.com" }
```

Because the pager currently requests only `{ id text value }`, every mirror-backed field is stored as empty string. Affected: `manager_email_raw`, and the job-title and employee-email lookups on Requests; `manager_email` and `role` on Attendance Forms; `state` on Contracts.

## The fix

1. In `mondaySync.ts`, change the `column_values` selection in **both** the first-page and the `next_items_page` queries built by `pullAllItems` from:

```
column_values(ids: [...]) { id text value }
```

to:

```
column_values(ids: [...]) { id type text value ... on MirrorValue { display_value } }
```

Keep everything else about the query identical — same `items_page(limit: 500)`, same cursor handling, same `{ query, variables: {} }` call through `pullMondayBoard`, and still no `{{params.…}}` inside any quoted string.

2. In `mondaySync.ts`, update the `colText(item, colId)` helper so it prefers the mirror value when present:

```ts
export function colText(item: MondayItem, colId: string): string {
  const c = item.column_values.find(v => v.id === colId);
  if (!c) return '';
  // Mirror/lookup columns return text: null; the readable value is display_value.
  return ((c.display_value ?? c.text) ?? '').trim();
}
```

3. Widen the `MondayItem` column type to include the two new optional fields, e.g. `{ id: string; type?: string; text: string | null; value: string | null; display_value?: string | null }`. Adjust any type that currently declares `text: string` so a null no longer breaks it.

4. Do not change how native columns are read, and do not change date parsing: date and timeline columns must still be parsed from `value` JSON and stored as the `YYYY-MM-DD` text Monday returns, with no timezone conversion.

Acceptance:
- Both queries in `pullAllItems` request `type` and `... on MirrorValue { display_value }`.
- `colText` returns `display_value` when it is present and falls back to `text` otherwise.
- After I re-run the syncs, `monday_requests.manager_email_raw` is populated for rows whose Monday item has a manager email — e.g. item 11047952194 (Daniel Escruceria) should hold `Jessica.C@avondalecaregrouppa.com`, and item 11003434294 (Natalia Esquivel) should hold `Marcela.G@vitasyahc.com`.
- No board or column ID is hardcoded anywhere.
- `MondayTab.tsx` does not grow.
