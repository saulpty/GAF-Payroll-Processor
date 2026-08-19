# PTO Tracker v2 — one table, one page, premium shell

**Date:** 2026-08-19 · **Owner:** Saul · **Status:** approved in conversation, this is the written record.

## Why

The PTO tracker works but reads like three separate tools. Tim's real job is
"look at one employee, see where they stand, act on what is waiting" — and today
that takes three tabs, two redundant lists on the Approvals tab, a name field
nobody needs, and a pending list of 55 that is really 2 because the Excel import
already holds the other 53. This spec collapses all of it into one table where
every employee is a row that opens into their full picture.

A nav fix and a visual pass on the shared shell ride along, because the page
should look like the product it now is.

## What changes, in the owner's words

1. Pending Monday requests already in the ledger from the Excel import must stop
   showing as pending — except Navvad Owusu (2026-08-26 → 27) and Elizabeth
   Mootoo (2026-08-17 → 09-07), which are genuinely unrecorded.
2. The Record dialog must show what the employee requested on Monday and what we
   are recording, side by side. "Recorded by" goes away.
3. The two lists on Approvals (pending cards + ledger table) are redundant; act on
   everything in one place, with real buttons.
4. Filters and alphabetical sorting on everything.
5. Balances: frozen header, tooltips, click an employee to expand their
   breakdown; Approvals and Floating Holidays fold into that breakdown. Columns:
   Employee, Title, Start, Accrued, Taken, Available, Paid PTO, FH left, WFH,
   Birthday, Pending. TFT hours column deleted.
6. Nav: "People" group makes no sense; PTO Tracker takes that slot top-level.
7. Premium UI/UX pass, using the `frontend-ui-engineering`, `ui-styling` and
   `ui-ux-pro-max` skills, scoped to PTO Tracker + nav + shared shell.

## Decisions taken

| # | Decision | Why |
|---|---|---|
| D1 | **Link** Excel rows to Monday items (stamp `monday_item_id`), do not delete. | Taken stays correct; nothing is lost; Pending becomes honest. |
| D2 | Breakdown holds **everything**: pending requests, recorded ledger, floating holidays. | One place per employee, per the owner. |
| D3 | Premium pass covers PTO page, TopNav, FilterBar and **app-level** shared pieces. `src/components/ui/*` (shadcn) and all payroll pages stay untouched. | Other pages inherit via TopNav/FilterBar; zero risk to payroll. |
| D4 | Future HR pages (360, contracts, calendar) each get their own top-level nav button. | Owner's call. |
| D5 | `recorded_by` column stays in the DB; the UI stops asking. New rows write `'app'`. | No migration, old rows keep their provenance. |
| D6 | Strangler: build `PtoTracker` v2 beside the old tabs, verify live, then delete the old five files in a final prompt. | Same pattern that worked for Admin → Employees. |

## 1. Data: link Excel-imported approvals to their Monday items

One migration, `link_excel_approvals_to_monday`, applied in UIB:

```sql
-- Excel-imported PTO rows have no monday_item_id, so the matching Monday
-- request still shows as pending. Link each to the request with the same
-- employee and leave date. Idempotent; never creates a second link to one item.
UPDATE pto_approvals a
SET    monday_item_id = r.monday_item_id,
       source         = 'monday',
       updated_at     = NOW()
FROM   monday_requests r
WHERE  a.monday_item_id IS NULL
  AND  a.source = 'excel_import'
  AND  r.request_type = 'PTO / Vacation'
  AND  r.deleted_on_monday = false
  AND  r.employee_id = a.employee_id
  AND  r.start_date  = a.leave_on
  AND  NOT EXISTS (SELECT 1 FROM pto_approvals x WHERE x.monday_item_id = r.monday_item_id);
```

**Acceptance:** after apply, `loadPendingPtoRequests` returns exactly the
requests for Navvad Owusu and Elizabeth Mootoo (2 rows). The number of rows the
UPDATE touched is recorded in the commit message. Any pending request left over
beyond those two is listed in the commit message for the owner to decide
(`leave_on` in Excel differing from Monday's `start_date` is the only way one
can slip through).

If two Monday requests share an employee + start date (a resubmission), the
`NOT EXISTS` guard links the first and leaves the second pending; that is
correct — it is a duplicate request, to be deleted on Monday so the next sync
drops it.

## 2. One page: `/pto`

### 2.1 Layout

```
PTO Tracker                                   [As of ▾ 2026-08-19] [Add manually] [Export]
Search… · Manager ▾ · Role ▾ · [ ] only with pending · [ ] show withdrawn
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Employee ▲  Title  Start  Accrued  Taken  Available  Paid PTO  FH left  WFH  Bday  Pending │  ← sticky
├──────────────────────────────────────────────────────────────────────────────────┤
│ ▸ Charles Bush     …                                                        (1)  │
│ ▾ Domingo Cruz     …                                                        (2)  │
│   ┌ breakdown ─────────────────────────────────────────────────────────────┐     │
│   │ PENDING FROM MONDAY                                                    │     │
│   │  2026-12-07 → 12-11 · requested 4 d · "family trip"       [Record]     │     │
│   │ RECORDED PTO                                   taken 15.0 d            │     │
│   │  2026-06-15 → 06-30 · 15 d · "CSS block 1"   [Edit] [Withdraw]         │     │
│   │  2026-02-02 → 02-03 · 1 d · withdrawn (hidden unless toggled)          │     │
│   │ FLOATING HOLIDAYS 2026     used 1 of 2 · eligible since 2025-04-10  [−][+] │  │
│   └────────────────────────────────────────────────────────────────────────┘     │
│ ▸ Elizabeth Mootoo …                                                        (1)  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- The **tabs are gone**; `?tab=` in old links is ignored.
- **Sticky header**: `thead` is `position: sticky; top: 0` inside the scroll
  container, with a solid background and a bottom border so rows scroll under it.
- **Sort**: every column header is a button. First click sorts ascending (A→Z or
  low→high), second click descending, third clears back to the default
  (Employee A→Z). Exactly one sort active at a time; the active header shows
  an arrow. Sorting is client-side on the loaded rows.
- **Filters**: the global Employee / Manager / Role filters from `FilterBar`
  continue to apply (they already do). Added on the page: a text search over
  employee name and title (debounced, client-side), **only with pending**, and
  **show withdrawn** (affects the breakdown ledger).
- **Tooltips** (native `title` on the header cell, plus an `ⓘ` icon styling):
  - Accrued — "DAYS360(start, as-of) ÷ 11, the sheet's formula. ≈ 1 day per 11 calendar days."
  - Taken — "Sum of recorded PTO days. Withdrawn rows don't count."
  - Available — "Accrued − Taken. Red when negative."
  - Paid PTO — "Days already paid in advance (CSS 2-week blocks). Manual."
  - FH left — "2 per calendar year, non-stacking, eligible 90 days after hire."
  - WFH / Birthday — "Approved Monday requests this year."
  - Pending — "Monday PTO requests not yet recorded or dismissed."
- **Pending** shows a count badge; zero renders as a muted dash.
- **As-of** date picker stays (the accrual is as of that date), default today
  via `toLocalYMD`.
- **Export** keeps producing the same workbook, minus TFT.

### 2.2 Expanding a row

Clicking anywhere on a row (except the Pending badge, which also expands) toggles
its breakdown. More than one row can be open. Expansion calls
`loadPtoEmployeeDetail({ employee_id, year })` once and caches in component
state; a small spinner shows inside the panel until it returns. The panel has
three blocks, each with its own empty state:

1. **Pending from Monday** — one line per request: dates, Monday's requested
   days, reason (truncated, full on hover), and a `[Record]` primary button.
   There is no Dismiss: a request that should never be recorded is handled on
   Monday (deleted/declined there), and the mirror's `deleted_on_monday` flag
   removes it from Pending on the next sync. Empty: "Nothing waiting."
2. **Recorded PTO** — rows sorted newest first: leave → return, days, comments,
   source chip (Monday / Excel / Manual), `[Edit]` and `[Withdraw]` outline
   buttons. Withdrawn rows hidden unless "show withdrawn" is on, then shown
   struck-through with a "withdrawn" chip and no actions. Block header shows the
   total taken. Empty: "No PTO recorded."
3. **Floating holidays {year}** — "used N of 2", eligibility date (or "eligible
   from …" if not yet), `[−] [+]` stepper bounded 0..2 writing
   `upsertFloatingHoliday` immediately, optimistic, with error rollback.

After any write (record, edit, withdraw, FH change) the page reloads the
balances row set **and** that employee's detail, so Taken/Available/Pending/FH
update in the table without a full refresh.

### 2.3 Record dialog (`RecordApprovalDialog.tsx`, reworked)

Three modes stay (record / edit / manual). Layout:

```
Record PTO · Domingo Cruz
┌ Requested on Monday ───────────────────────────────┐   (record mode only)
│ 2026-12-07 → 2026-12-11 · 4 days · "family trip"   │
└────────────────────────────────────────────────────┘
Recording
  Leave on [2026-12-07]   Return on [2026-12-11]
  Total days [4]   ← pre-filled return − leave (calendar days, the sheet's rule), editable
  Comments [                ]
                                   [Cancel] [Record approval]
```

- If the pre-filled total differs from Monday's requested number, a quiet note
  under the field: "Monday request said 1 day; calendar span is 3." No blocking.
- **No "Recorded by" field.** `recorded_by` is sent as `'app'` for new rows and
  left unchanged on edit.
- Validation unchanged: dates required, return ≥ leave (string compare),
  total > 0, employee chosen in manual mode.

### 2.4 Nav

`TopNav.tsx`: remove the `people` section. Add PTO Tracker as a top-level
section in its slot (`id: 'pto'`, label "PTO Tracker", `Palmtree` icon, same
purple, `home: '/pto'`, `paths: ['/pto']`, `links: []` so no sub-row renders).
`FilterBar.tsx` keeps treating `/pto` as it does today.

## 3. Premium pass — scope and rules

**In scope:** `TopNav.tsx`, `FilterBar.tsx`, the new PTO files, and a small set
of **app-level** presentational pieces under `src/app/components/` that the PTO
page uses and later pages can adopt: `PageHeader.tsx`, `DataTable.tsx` (sticky
header + sortable `th`), `StatusChip.tsx`, `EmptyState.tsx`, `InfoTip.tsx`.
Global tokens only in `src/index.css`/tailwind config **if** the change is
additive (a shadow token, a font stack) — no change to existing class meaning.

**Out of scope:** anything under `src/components/ui/` (shadcn), every payroll /
attendance / admin page. They inherit whatever TopNav and FilterBar gain and
nothing else.

**Direction** (the three skills decide the details; these are the guardrails):
- 8-pt spacing; one type scale (page title, section label, body, caption).
- Purple is an accent (active nav, primary button, focus ring), not a flood.
- Tables: 13 px body, tabular numerals right-aligned, zebra off, row hover on,
  header uppercase caption with muted colour, sticky.
- Chips: soft fill + icon for Recorded / Pending / Withdrawn / Monday / Excel / Manual.
- Buttons: one primary per view; secondary = outline; destructive (Withdraw) =
  outline red, confirm before writing.
- States: skeleton or spinner on load, `EmptyState` with one line of copy, error
  banner with the action name.
- Dialog: title + context line ("Domingo Cruz · Monday request"), sections
  separated by a labelled divider, primary action right.

## 4. Files

**Created in UIB:**
- `src/actions/loadPtoEmployeeDetail.ts` — pending + ledger + FH for one
  employee (`employee_id`, `year`, optional `manager`).
- `src/app/components/{PageHeader,DataTable,StatusChip,EmptyState,InfoTip}.tsx`
- `src/app/pages/pto/PtoTable.tsx`, `PtoRow.tsx`, `PtoBreakdown.tsx`,
  `ptoSort.ts` (pure sort/filter helpers, zero imports, node-testable).
- `src/migrations/<ts>_link_excel_approvals_to_monday.sql`

**Modified in UIB:**
- `src/app/pages/PtoTracker.tsx` (becomes the one-table page; loses tabs)
- `src/app/pages/pto/RecordApprovalDialog.tsx`
- `src/app/TopNav.tsx`, `src/app/FilterBar.tsx`
- `src/actions/loadPtoBalancesInputs.ts` (drop `tft_hours`)

**Deleted (last prompt, after live verification):**
`BalancesTab.tsx`, `BalancesRow.tsx`, `ApprovalsTab.tsx`, `ApprovalRow.tsx`,
`FloatingHolidaysTab.tsx`; `loadPtoApprovals.ts` and `loadFloatingHolidays.ts`
only if nothing else imports them (check with grep before the prompt).

**Local:** `tests/ptoSort.test.ts`; `tests/hardcoding.test.ts` H5 list gains the
five deleted files.

## 5. Acceptance (what "done" means)

1. Pending total on the page = 2 (Navvad, Elizabeth) right after the migration.
2. `/pto` has no tabs; header sticks; each column header sorts three-state;
   search + only-with-pending + show-withdrawn work.
3. Clicking Domingo Cruz opens his breakdown showing his recorded PTO with
   dates and days that sum to his Taken; Record / Edit / Withdraw / FH stepper
   all write and the row's numbers update without page reload.
4. Record dialog shows the Monday block above the Recording block; no
   "Recorded by" field; saving writes `recorded_by = 'app'`.
5. Nav shows PTO Tracker top-level; no "People".
6. `node --test "tests/*.test.ts"` green (83 + ptoSort tests); every file
   under 15 KB; no Monday id in code; `git status` shows only named files per
   prompt; no payroll file touched.
7. Before/after screenshots of `/pto` and the nav saved under
   `docs/findings/2026-08-19-pto-v2/`.
