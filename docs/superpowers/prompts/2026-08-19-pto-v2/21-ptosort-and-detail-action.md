Three small additions for the one-table PTO tracker. Files that may be created: `src/app/lib/ptoSort.ts`, `src/actions/loadPtoEmployeeDetail.ts`. File that may be modified: `src/actions/loadPtoBalancesInputs.ts`. No other file may change.

## 1. `src/app/lib/ptoSort.ts` — exact code, zero imports

```ts
// Pure sort/filter helpers for the PTO table. No imports: node tests load this directly.
export type SortDir = 'asc' | 'desc' | null;

export function nextSortDir(current: SortDir): SortDir {
  if (current === null) return 'asc';
  if (current === 'asc') return 'desc';
  return null;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

/** Numbers numerically, strings case-insensitively; empties always last. */
export function compareValues(a: unknown, b: unknown): number {
  const ea = isEmpty(a), eb = isEmpty(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na - nb;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

/** Stable sort. key/dir null -> fallbackKey ascending. Empties last in both directions. Never mutates. */
export function sortRows<T>(rows: T[], key: keyof T | null, dir: SortDir, fallbackKey: keyof T): T[] {
  const k: keyof T = key !== null && dir !== null ? key : fallbackKey;
  const d: 'asc' | 'desc' = key !== null && dir !== null ? dir : 'asc';
  const sign = d === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = x.r[k] as unknown, b = y.r[k] as unknown;
      const ea = isEmpty(a), eb = isEmpty(b);
      if (ea !== eb) return ea ? 1 : -1;           // empties last regardless of direction
      const c = compareValues(a, b) * sign;
      return c !== 0 ? c : x.i - y.i;
    })
    .map(x => x.r);
}

export function matchesSearch(row: { display_name: string; role: string | null }, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return row.display_name.toLowerCase().includes(s) || (row.role ?? '').toLowerCase().includes(s);
}
```

## 2. `src/actions/loadPtoEmployeeDetail.ts` — SQL action, datasource `GAF Planilla DB`

Returns exactly one row with three JSON columns for one employee. Params: `employee_id`, `year`, `manager`. Follow the same file shape as the other `load*` actions (default-exported function returning `action('loadPtoEmployeeDetail', 'SQL', { datasourceName, query })`).

```sql
SELECT
  COALESCE((
    SELECT json_agg(json_build_object(
      'monday_item_id', r.monday_item_id, 'employee_id', r.employee_id, 'display_name', e.display_name,
      'employee_name_raw', r.employee_name_raw, 'leave_on', r.start_date::text, 'return_on', r.return_date::text,
      'total_days', r.total_days_requested, 'reason', r.reason, 'submitted_at', r.submitted_at::text
    ) ORDER BY r.start_date DESC)
    FROM monday_requests r
    LEFT JOIN employees e ON e.id = r.employee_id
    LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
    WHERE r.employee_id = {{params.employee_id}}::bigint
      AND r.request_type = 'PTO / Vacation' AND r.deleted_on_monday = false AND a.id IS NULL
  ), '[]'::json) AS pending,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', a.id, 'employee_id', a.employee_id, 'display_name', e.display_name,
      'leave_on', a.leave_on::text, 'return_on', a.return_on::text, 'total_days', a.total_days,
      'status', a.status, 'source', a.source, 'gaf_comments', a.gaf_comments, 'recorded_by', a.recorded_by,
      'monday_item_id', a.monday_item_id, 'recorded_at', a.recorded_at::text
    ) ORDER BY a.leave_on DESC, a.id DESC)
    FROM pto_approvals a LEFT JOIN employees e ON e.id = a.employee_id
    WHERE a.employee_id = {{params.employee_id}}::bigint
  ), '[]'::json) AS ledger,
  (
    SELECT json_build_object(
      'fh_allocated', COALESCE(fh.fh_allocated, 2), 'fh_used', COALESCE(fh.fh_used, 0), 'notes', fh.notes,
      'start_date', e.start_date::text, 'pto_start_date_override', pe.pto_start_date_override::text
    )
    FROM employees e
    LEFT JOIN pto_employees pe ON pe.employee_id = e.id
    LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year = {{params.year}}::int
    WHERE e.id = {{params.employee_id}}::bigint
      AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
  ) AS fh
```

## 3. `src/actions/loadPtoBalancesInputs.ts`

Remove the `tft_hours` sub-select — the whole line
`(SELECT COALESCE(SUM(hours_approved),0) FROM monday_requests r WHERE r.employee_id = e.id AND r.permission_type = 'Time for Time' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM COALESCE(r.start_date, r.submitted_at::date)) = {{params.year}}) AS tft_hours`
and the comma that precedes it. Everything else in that query stays byte-identical.

## Constraints
- No Monday board, column or group id anywhere in these files.
- `{{params.x}}` is never placed inside a quoted string.
- Each file under 15 KB.
- Do not touch any page, any other action, or anything under `src/components/ui/`.
