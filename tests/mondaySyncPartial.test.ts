import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pullAllItems, batchUpsert } from '../src/app/pages/admin/employees/mondaySync.ts';

// Bug (2026-09-23): Monday returns HTTP 200 with { errors: [...] } on a failed query — no
// throw from fetch. pullAllItems only checks this on the FIRST page; on a later page it
// treated a missing next_items_page as "no more pages" and silently returned a truncated
// list. batchUpsert then fed that truncated (or empty) seenIds straight into markDeleted,
// which has no WHERE clause and flags every unseen row deleted_on_monday = true.
//
// These tests describe the fixed behaviour and FAIL against today's mondaySync.ts.

test('M1: pullAllItems rejects when a later page comes back as a GraphQL error, naming the board and the Monday message', async () => {
  let call = 0;
  const fakePull = async () => {
    call++;
    if (call === 1) {
      return {
        data: {
          boards: [{
            items_page: {
              cursor: 'page2cursor',
              items: [{ id: '1', name: 'Item One', column_values: [] }],
            },
          }],
        },
      };
    }
    // Monday's HTTP-200-with-errors shape for a failed page 2 query.
    return { errors: [{ message: 'Complexity budget exhausted' }] };
  };

  await assert.rejects(
    () => pullAllItems('9988776', [], fakePull),
    (err: unknown) => {
      assert.ok(err instanceof Error, 'must reject with an Error');
      assert.match(err.message, /9988776/, 'error should name the board id');
      assert.match(err.message, /Complexity budget exhausted/, 'error should include the Monday error message');
      return true;
    },
  );
  assert.equal(call, 2, 'both pages should have been requested');
});

test('M2: pullAllItems still throws when the FIRST page is missing items_page (unchanged behaviour)', async () => {
  const fakePull = async () => ({ errors: [{ message: 'Board not found' }] });
  await assert.rejects(
    () => pullAllItems('123', [], fakePull),
    /items_page/,
  );
});

test('M3: pullAllItems still returns everything for a normal multi-page pull with no errors', async () => {
  let call = 0;
  const fakePull = async () => {
    call++;
    if (call === 1) {
      return {
        data: {
          boards: [{
            items_page: {
              cursor: 'c1',
              items: [{ id: '1', name: 'A', column_values: [] }],
            },
          }],
        },
      };
    }
    return {
      data: {
        next_items_page: {
          cursor: null,
          items: [{ id: '2', name: 'B', column_values: [] }],
        },
      },
    };
  };
  const items = await pullAllItems('123', [], fakePull);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(i => i.id), ['1', '2']);
});

test('M4: batchUpsert never calls markDeleted when seenIds is empty', async () => {
  let markDeletedCalled = false;
  let upsertCalled = false;
  await batchUpsert(
    [],
    [],
    async () => { upsertCalled = true; },
    async () => { markDeletedCalled = true; },
  );
  assert.equal(markDeletedCalled, false, 'markDeleted must not run with an empty seenIds — it would flag the whole table deleted');
  assert.equal(upsertCalled, false, 'no rows means no upsert call either');
});

test('M5: batchUpsert still calls markDeleted exactly once with a non-empty seenIds', async () => {
  let markDeletedCalls = 0;
  let lastSeenIds: string[] = [];
  await batchUpsert(
    [{ monday_item_id: '1' }],
    ['1', '2', '3'],
    async () => {},
    async (p: { seen_ids: string }) => {
      markDeletedCalls++;
      lastSeenIds = JSON.parse(p.seen_ids);
    },
  );
  assert.equal(markDeletedCalls, 1);
  assert.deepEqual(lastSeenIds, ['1', '2', '3']);
});
