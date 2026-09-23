# 07 — Payroll Master: the GREEN / YELLOW / RED tabs cover the whole period, not just the loaded page

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may change. No other file may be touched.**

- `src/app/pages/PayrollMaster.tsx`

Do not create files. Do not touch any action (`loadPayrollMaster` and `countPayrollMaster` already
filter by status and must stay exactly as they are), lib, context, `FilterBar.tsx`, migration or
other page. Do not reformat, reorder or rename anything you are not asked to change. This is a
payroll file: change only the lines named below.

## Why

Payroll Master loads 500 rows at a time (`LIMIT 500 OFFSET …`). The ALL / GREEN / YELLOW / RED
tabs in the filter bar only filter the 500 rows already on screen. On a period (or All Periods)
with more than 500 rows, the RED tab silently misses every RED row that sits on another page, and
the "N total rows" line under the table still counts every status.

`loadPayrollMaster` and `countPayrollMaster` already accept a `status` parameter
(`AND (COALESCE({{params.status}}, '') = '' OR pe.status_current = {{params.status}})`), and the
page already passes `params.status` to both — but `params.status` is always `''`. The fix is to
set it from the tab, so the database does the filtering, and go back to page 1 when the tab
changes.

The tab value comes from `useGlobalFilters()` as `activeTab` (already destructured near the top
of the component). There are no count badges on the tabs, so nothing else needs a count.

**Parameters stay flat.** `params` is passed straight as the third argument of `useLoadAction`,
exactly as today. Never wrap it as `{ params: … }`.

## 1. The initial params state

In the `useState` that creates `params`, replace

```ts
    status: '',
```

with

```ts
    status: activeTab === 'ALL' ? '' : activeTab,
```

(The tab is remembered in the global filter context, so the page can open on RED; the first load
must already ask for RED.)

## 2. A new effect: the tab drives the status filter

Directly **after** the existing effect that ends with

```ts
  }, [globalPeriod, globalEmployee, searchParams]);
```

add this new effect (do not change the existing one):

```ts
  // The tab filters in the database, so GREEN / YELLOW / RED cover the whole period, not just this page.
  useEffect(() => {
    setParams(prev => ({ ...prev, status: activeTab === 'ALL' ? '' : activeTab, offset: 0 }));
    setPage(0);
  }, [activeTab]);
```

Do **not** call `discardAll()` or clear `savedIds` in it — switching tab keeps unsaved drafts,
the same way Prev / Next already do.

## 3. Leave the loaders and the client-side filter alone

- Keep `useLoadAction(loadPayrollMasterAction, [] as EntryRow[], params, { enabled: periodChosen })`
  exactly as it is.
- Keep the `countPayrollMasterAction` call exactly as it is — it already passes
  `status: params.status`, so the "Page X of Y (N total rows)" line becomes the tab's total with
  no further change.
- Keep the line in `filtered`
  `let out = activeTab === 'ALL' ? allRows : allRows.filter(r => r.status_current === activeTab);`
  unchanged. Every loaded row now already matches the tab, so it does nothing; it stays as a
  safety net.

## 4. Export CSV: say that it exports only the page on screen

`exportCsv` exports `filtered`, which is the rows on the current page. Do not change `exportCsv`.
Instead, in the toolbar, immediately **before** the Export CSV button

```tsx
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || filtered.length === 0}>
```

add

```tsx
          {totalPages > 1 && (
            <span className="text-xs text-muted-foreground">CSV exports this page only ({page+1} of {totalPages})</span>
          )}
```

Nothing else in the toolbar changes.

## Acceptance (observable on /dev → Payroll Master)

Choose **All Periods** in the period picker (it has well over 500 rows).

- **ALL tab:** the line under the table reads "Page 1 of N (T total rows)". Next to Export CSV
  the note "CSV exports this page only (1 of N)" is shown.
- Click **Next** to page 2, then click the **RED** tab: the table jumps back to **page 1**, every
  row's Status badge is **RED**, and the line under the table shows the **RED total**, which
  equals `SELECT COUNT(*) FROM payroll_entries WHERE deleted_at IS NULL AND status_current = 'RED'`.
  If that total is 500 or less, the pagination line is hidden and the table shows exactly that
  many rows (no more "missing" REDs from other pages).
- **YELLOW** and **GREEN** behave the same way against their own counts. Back on **ALL**, the
  total returns to T.
- Leave Payroll Master on RED, go to another page, come back: it opens on RED and the first load
  already shows only RED rows.
- On a single period with fewer than 500 rows, nothing looks different except that each tab's
  rows now come straight from the database; the Export note is hidden.
- Editing and saving a RED row to GREEN, bulk edit, Undo Bulk and Delete work as before.
- `src/app/pages/PayrollMaster.tsx` is the only file changed.
