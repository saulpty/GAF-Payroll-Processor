// Shared plumbing for all Monday board sync functions.
// No React, no JSX, no hooks. Plain TypeScript only.

export type MondayItem = {
  id: string;
  name: string;
  group?: { id: string; title: string };
  column_values: { id: string; type?: string; text: string | null; value: string | null; display_value?: string | null }[];
};

type PageResult = { cursor: string | null; items: MondayItem[] };

export type PullFn = (p: { query: string; variables: Record<string, never> }) => Promise<unknown>;
export type UpsertFn = (p: { rows: string }) => Promise<unknown>;
export type DeletedFn = (p: { seen_ids: string }) => Promise<unknown>;

export interface SyncDeps {
  cfg: Record<string, string>;
  pull: PullFn;
  resolve: (name: string | null | undefined, email: string | null | undefined) => number | null;
  upsert: UpsertFn;
  markDeleted: DeletedFn;
}

export interface SyncResult { items: number; matched: number; unmatched: number }

// ── requireKeys ────────────────────────────────────────────────────────────────

/** Returns { ok: true, map } when all keys are present, or { ok: false, missing } */
export function requireKeys<K extends string>(
  cfg: Record<string, string>,
  keys: readonly K[],
): { ok: true; map: Record<K, string> } | { ok: false; missing: K[] } {
  const missing = keys.filter(k => !cfg[k]);
  if (missing.length > 0) return { ok: false, missing: missing as K[] };
  return { ok: true, map: cfg as Record<K, string> };
}

// ── pullAllItems ───────────────────────────────────────────────────────────────

export async function pullAllItems(
  boardId: string,
  columnIds: string[],
  pull: PullFn,
): Promise<MondayItem[]> {
  const colList = JSON.stringify(columnIds);

  const firstQuery = `{
    boards(ids: [${boardId}]) {
      items_page(limit: 500) {
        cursor
        items {
          id name
          group { id title }
          column_values(ids: ${colList}) { id type text value ... on MirrorValue { display_value } }
        }
      }
    }
  }`;

  const raw = await pull({ query: firstQuery, variables: {} });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const firstPage = (raw as any)?.data?.boards?.[0]?.items_page as PageResult | undefined;
  if (!firstPage) throw new Error('Monday returned no items_page for board ' + boardId);

  const all: MondayItem[] = [...(firstPage.items ?? [])];
  let cursor = firstPage.cursor ?? null;

  while (cursor) {
    const nextQuery = `{
      next_items_page(limit: 500, cursor: "${cursor}") {
        cursor
        items {
          id name
          group { id title }
          column_values(ids: ${colList}) { id type text value ... on MirrorValue { display_value } }
        }
      }
    }`;
    const nextRaw = await pull({ query: nextQuery, variables: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextPage = (nextRaw as any)?.data?.next_items_page as PageResult | undefined;
    if (!nextPage) break;
    all.push(...(nextPage.items ?? []));
    cursor = nextPage.cursor ?? null;
  }
  return all;
}

// ── column helpers ─────────────────────────────────────────────────────────────

export function colText(item: MondayItem, colId: string): string {
  const c = item.column_values.find(v => v.id === colId);
  if (!c) return '';
  // Mirror/lookup columns return text: null; the readable value is in display_value.
  return ((c.display_value ?? c.text) ?? '').trim();
}

export function colValue(item: MondayItem, colId: string): string {
  return (item.column_values.find(c => c.id === colId)?.value ?? '').trim();
}

/** Parse a Monday date column value → YYYY-MM-DD, or '' */
export function parseDate(item: MondayItem, colId: string): string {
  const raw = colValue(item, colId);
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { date?: string };
    if (parsed?.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) return parsed.date;
  } catch { /* ignore */ }
  const m = colText(item, colId).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** Parse a Monday date-range column → { from, to } both YYYY-MM-DD or '' */
export function parseDateRange(item: MondayItem, colId: string): { from: string; to: string } {
  const raw = colValue(item, colId);
  if (!raw) return { from: '', to: '' };
  try {
    const parsed = JSON.parse(raw) as { from?: string; to?: string };
    return {
      from: parsed?.from ?? '',
      to:   parsed?.to   ?? '',
    };
  } catch { return { from: '', to: '' }; }
}

// ── batchUpsert ────────────────────────────────────────────────────────────────

/** Upsert rows in chunks of 100, call markDeleted with all seen item ids */
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
