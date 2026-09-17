# 11 — Keep the Teramind saved copy fresh while a super user has the Hub open

**Paths are written as they appear in our git mirror. Inside this project the code root *is* `src`,
so `src/app/…` means `app/…`, `src/actions/…` means `actions/…`, `src/migrations/…` means
`migrations/…`. Never create a top-level folder named `src`.**

## Files that may change

- `src/migrations/1782003200_teramind_sync_interval.sql` — NEW, content below, character for character (apply it)
- `src/actions/loadTeramindPullLog.ts` — REPLACE with the content below, character for character
- `src/app/pages/admin/teramind/useTeramindPull.ts` — one type-only edit (section 3)
- `src/app/components/TeramindAutoSync.tsx` — NEW (you write it, section 4)
- `src/app/app.tsx` — smallest edit: import `TeramindAutoSync` and render `<TeramindAutoSync />` on the
  line directly after the existing `<AccessAutoSync />`. Touch nothing else in this file — no route,
  no wrapper, no formatting.

No other file may be touched. Never edit `ProcessPayroll.tsx`, `PayrollMaster.tsx`,
`ActionRequired.tsx`, `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or anything
under `src/components/ui/`.

## Why

Teramind's Time Records are live, but our saved copy only updates when someone clicks Pull. The
owner wants the Hub "as live as possible". Until a server-side job exists, the copy is refreshed
quietly from the browser of any **super user** who has the Hub open — the same idea as
`AccessAutoSync`. Managers never trigger a pull; they only read the saved copy.

## 1. Migration — verbatim

```sql
-- Teramind keep-fresh sync: the interval was seeded as 180 minutes when we believed Teramind only
-- updated once a day. The Time Records feed is live, so the default becomes 15 minutes.
-- Only touches the row if nobody has changed it by hand.

UPDATE classification_config
SET value = '15',
    description = 'How often the Hub refreshes today''s Teramind time records while a super user has it open. Minimum 5.',
    updated_at = NOW()
WHERE key = 'teramind_sync_every_minutes'
  AND value = '180';

-- ROLLBACK
-- UPDATE classification_config SET value = '180' WHERE key = 'teramind_sync_every_minutes' AND value = '15';
```

## 2. `src/actions/loadTeramindPullLog.ts` — verbatim

```ts
import { action } from '@uibakery/data';

// Pull history for the Teramind admin tab. Automatic keep-fresh pulls happen every few minutes, so
// only the five most recent of them are returned — otherwise they would push the manual, backfill
// and capture rows (which "already covered" checks depend on) out of the list.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindPullLog() {
  return action('loadTeramindPullLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        id,
        date_from,
        date_to,
        pulled_at,
        pulled_by,
        trigger,
        agent_count,
        row_count,
        saved_count,
        truncated,
        error,
        source
      FROM teramind_pull_log
      WHERE trigger <> 'auto'
         OR id IN (SELECT id FROM teramind_pull_log WHERE trigger = 'auto' ORDER BY pulled_at DESC LIMIT 5)
      ORDER BY pulled_at DESC
      LIMIT 150;
    `,
  });
}

export default loadTeramindPullLog;
```

## 3. `useTeramindPull.ts` — type-only edit

The `trigger` parameter of `pullRange` becomes `'manual' | 'backfill' | 'capture' | 'auto'`. Nothing
else in this file changes.

## 4. `src/app/components/TeramindAutoSync.tsx` — you write this

Renders nothing (`return null`). Model: `src/app/components/AccessAutoSync.tsx` and the throttle /
in-flight pattern in `src/app/pages/admin/access/useAccessSync.ts`.

- Runs **only when `useViewer().isSuper` is true** (and the viewer is loaded). For anyone else the
  component does nothing at all — no action call, no timer.
- Interval: `teramind_sync_every_minutes` from the existing `loadClassificationConfig` action
  (rows of `{ key, value }`); parse as a number; default 15; never below 5.
- "When did we last sync?" = the newest row from `loadTeramindPullLog` with `trigger === 'auto'` and no
  `error`. `pulled_at` is a real instant (timestamp with time zone) — comparing it with `Date.now()`
  is correct.
- Check on mount and then every 60 seconds (`setInterval`, cleared on unmount). When the last
  automatic sync is older than the interval (or there is none) **and** no pull is in flight:
  `const range = keepFreshRange(easternDate(Date.now()))` — `keepFreshRange` from
  `@/app/lib/teramindPull`, `easternDate` from `@/app/lib/teramindTime` — then
  `await pullRange(range.from, range.to, 'auto')` from `useTeramindPull()`, then reload the log.
- A **module-level** `let inFlight = false` guards against overlapping runs (two mounted copies, a
  slow pull). Set it before the pull, clear it in `finally`.
- Never throws into React and never shows UI: `catch` → `console.warn('Teramind keep-fresh sync failed:', e)`.
  The hook already writes a failed row to the pull log. After a failure wait a full interval before
  trying again (remember the failure time in a module-level variable).
- Do not run while `document.hidden` is true (a background tab should not keep pulling).
- No date or time arithmetic in this file other than `Date.now()` comparisons; no `toISOString`; no
  `Intl`; the Eastern "today" comes from `easternDate` only.

## Rules

Every file under 15 KB · action params always **flat** · no hardcoded ids or URLs · this component
never writes to `payroll_entries` and never runs for a manager.

## Acceptance (check on /dev, signed in as a super user)

1. Only the five files above changed; `app.tsx` differs by one import line and one JSX line.
2. Within about a minute of opening any page, Admin → Employees → Teramind → Pull Log shows a new row
   with Trigger **Auto**, Source Time Records, a range of yesterday → today, and no error.
3. Reloading the page within the interval does **not** create another Auto row.
4. With "View As" set to a manager, no Auto row is ever created.
