# Screen edits — Contracts, Attendance, Payroll, brand (2026-09-10)

Saul's per-screen list, with what was found and what will be built.
Prompts: `docs/superpowers/prompts/2026-09-10-screen-edits/`. One change per prompt,
executed in order; each is synced, tested and loaded in the browser before commit.

## Findings that shaped the plan

- **Contracts already has the nav badge** (`loadContractsExpiringCount`, TopNav). It
  is empty today only because nothing ends within 30 days — the earliest end is
  Dec 8, 2026. It stays and keeps counting "ending within 30 days".
- **"Auto-renewing"** is an inference: any contract end in the past renders as
  *Renewed* (33 of 45 rows). No renewal is ever read from Monday. The fix reads
  the Onboarding board's status column `color_mktdvagn` (config key
  `monday_col_onboarding_renewal`, never a literal in code): **Passed = Renewed,
  Failed = Not renewed, anything else = Pending review.**
- **Tooltips never show** anywhere the ⓘ icon is used (Contracts, PTO,
  Disciplinary): `InfoTip` puts `title=` on an `<svg>`, which browsers do not
  render as a tooltip. Verified by hovering on `/dev`. Fix: wrap in a `<span>`.
- **Action Required "11 vs 18"**: the tab badge counts RED + YELLOW (18); the RED
  chip counts reds (11). Not a bug, but the page refuses to list "All periods":
  `loadActionRequired` has a bare `period_name =` and the page gates on a period.
  Payroll Master's SQL already handles all periods; only the page gate blocks it.
- **Attendance** tabs are URL-driven in `Attendance.tsx`; Dashboard and Trends are
  single-consumer and safe to delete. `fmtDay.ts` has the Date-free weekday math;
  a long form is added for the Recent Activity date.

## Decisions (assumptions Saul can overrule)

1. Payroll Dashboard is deleted entirely (page + its two actions), not just hidden.
2. Attendance List keeps the KPI tiles above the table.
3. Period picker on Attendance: multi-select of **processed** periods, newest
   first, default = newest. The date window is earliest start → latest end of the
   selection. Reports/List/Viewer keep reading `dateFrom`/`dateTo` unchanged.
4. Recent Activity date reads `Thursday, September 8, 2026`.
5. The 30-day contracts badge counts every contract ending within 30 days,
   decided or not; the row shows the renewal status.
6. App name in the nav: **GAF Panama** / HR Hub. The UI Bakery project is renamed
   to *GAF Panama HR Hub* in UIB's settings (zip name changes; sync script is
   name-agnostic). Logo lands as a small data-URI image in its own component.

## Prompt list

| # | Change | Files |
|---|---|---|
| 01 | Tooltips actually show | `InfoTip.tsx`, `ContractRow.tsx` |
| 02 | Contracts: drop 30/60/90 | `Contracts.tsx`, `ContractsTable.tsx` |
| 03 | Payroll nav without Dashboard | `TopNav.tsx`, `app.tsx`, `FilterBar.tsx`, `AGENTS.md`, delete 3 |
| 04 | Attendance: List + Reports only | `Attendance.tsx`, `TopNav.tsx`, `FilterBar.tsx`, `attendanceStats.ts`, `AGENTS.md`, delete 2 |
| 05 | List header tooltips | `AttendanceTable.tsx` |
| 06 | Recent Activity weekday date | `fmtDay.ts`, `AttendancePanel.tsx` |
| 07 | Attendance period picker | `GlobalFilterContext.tsx`, `FilterBar.tsx`, new `PeriodMultiSelect.tsx` |
| 08 | Action Required: all periods | `loadActionRequired.ts`, `loadCommittedEntries.ts`, `ActionRequired.tsx` |
| 09 | Payroll Master: all periods | `PayrollMaster.tsx` |
| 10 | Renewal status mirrored from Monday | migration, `syncContracts.ts`, `upsertMondayContracts.ts` |
| 11 | Renewal status on the page | `loadContractMilestones.ts`, `tenure.ts`, `ContractRow.tsx`, `ContractsTable.tsx`, `Contracts.tsx` |
| 12 | Brand: logo + GAF Panama | new `BrandLogo.tsx`, `TopNav.tsx` |

Tests written locally before the matching prompt: D5 (`fmtDayLong`), T7
(`renewalState`); L3 allowlist tightened after 04 and 06.
