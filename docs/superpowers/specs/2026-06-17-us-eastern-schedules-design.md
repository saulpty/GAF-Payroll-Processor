# US-Eastern–native schedules + historical conversion

**Date:** 2026-06-17
**Status:** Approved (design) — implementation in two phases
**Author:** Tim (operator) + Claude

## Problem

The app must display everything in **US Eastern** time so the US owners aren't
confused. Schedules, however, are stored in **Panama** time as a "DST pair"
(`dst_*`) and a "Standard pair" (`standard_*`), and the engine adds an hour for
summer display. This forces anyone editing a schedule to think in Panama time
*and* mentally add an hour — which already produced a wrong value for Favian
(displayed 8–6 instead of 10–6). Historical payroll rows (2,140) are also stored
in Panama time, so they read inconsistently with new US-Eastern runs.

Key facts (confirmed with the operator):
- **Teramind** timestamps are always US Eastern; **Monday** data is always Panama
  and is **date-only** (no clock times) — so Monday is unaffected by this work.
- Panama has no DST; US does. Eastern = Panama + 1 hr during US DST, equal in winter.
- Most employees are Eastern-synced → constant US-Eastern hours year-round.
- **Favian** works for an Arizona (no-DST) team → in US Eastern he is **9–5 in
  winter, 10–6 in summer.**
- Discounts/late/early are **relative**, so they're invariant to the display
  timezone — no pay changes from any of this.

## Decision: Approach A — reinterpret columns as US Eastern

Keep the four schedule time columns but redefine their meaning:
`dst_*` → **Summer (ET)**, `standard_*` → **Winter (ET)**. Store the actual
US-Eastern values (WYSIWYG). The engine then does no conversion.

Rejected alternatives:
- **B (single schedule + summer override):** cleaner editor but a real schema
  change + conditional engine logic; not worth it for 3 schedules.
- **C (keep Panama, convert in UI/engine):** keeps the hidden +1 hr "magic" that
  caused the confusion.

## Changes

### 1. Schedule data (migration, schedules table)
Explicitly `SET` the three known schedules to their correct US-Eastern values
(explicit, not arithmetic — idempotent and fixes Favian's bad current row):

| schedule_name | Summer (dst_start/end) | Winter (standard_start/end) | grace |
|---|---|---|---|
| Standard | 9:00 AM – 5:00 PM | 9:00 AM – 5:00 PM | 10 |
| Monique Luque schedule | 9:00 AM – 4:00 PM | 9:00 AM – 4:00 PM | 10 |
| Favian Fortune schedule | 10:00 AM – 6:00 PM | 9:00 AM – 5:00 PM | 10 |

Other (user-added) schedules are not touched.

### 2. Engine (`classificationEngine.ts`)
`getSchedule` reverts to `isDst ? {dst_*} : {standard_*}` — no `+1hr`. `isDst`
keeps its string-year robustness (still needed to pick summer vs winter). The
Teramind parser keeps raw (already-Eastern) times (already shipped).

### 3. Admin editor (`AdminSchedules.tsx`)
- Column labels: `DST Start/End` → **Summer (ET) Start/End**; `Std Start/End` →
  **Winter (ET) Start/End** (both the form and the table header).
- New-schedule default → 9:00 AM–5:00 PM / 9:00 AM–5:00 PM.
- Helper line: "Same in both for most people; set them differently only for teams
  that don't follow US daylight saving (e.g. Arizona)."
- Field/code names unchanged (`dst_start`, …) — labels only. A code comment notes
  the Eastern reinterpretation. (Optional future: rename columns.)

### 4. Historical conversion (migration, payroll_entries) — Phase 2
For each row whose **workdate** is inside a US DST window (all current history is),
shift these string columns by **+1 hour**, normalizing format to `H:MI AM`:
`entry_time`, `exit_time`, `scheduled_start`, `scheduled_end`, `grace_until`.
Leave `late_minutes`, `late_after_grace`, `early_leave_minutes`,
`discount_total_minutes`, statuses, events, impacts, notes **unchanged**.

Time-shift rule (handles mixed stored formats and NULLs):
- `… AM/PM` → parse `HH12:MI AM`, `+ 1 hour`, format `FMHH12:MI AM`.
- `HH24:MI(:SS)` (e.g. `17:00:00`) → parse `HH24:MI:SS`, `+ 1 hour`, format `FMHH12:MI AM`.
- anything else / NULL → unchanged.

Safety:
- **Guarded** against double-application via a `classification_config` marker key
  `history_tz_converted = 'true'` (migration is a no-op if already set).
- **Reversible** (documented inverse: −1 hour on the same columns/rows).
- Pay-safe by construction (only display-time columns move).
- **Cannot be fully tested locally** (no Postgres). The shift logic is proven in
  Node against sample inputs; verify on a few rows in UI Bakery before trusting.

## Testing
- `getSchedule`: returns Summer pair in DST, Winter pair otherwise; Favian 10–6
  summer / 9–5 winter; Standard/Monique constant. (`node --test`, Eastern data.)
- Time-shift helper: `8:12 AM→9:12 AM`, `11:30 AM→12:30 PM`, `12:00 PM→1:00 PM`,
  `5:00 PM→6:00 PM`, `17:00:00→6:00 PM`, `NULL→NULL`.
- Existing 22 tests stay green.

## Phasing
- **Phase 1 (low risk):** schedule data migration + engine + editor. Verify in UI
  Bakery: Favian shows 10–6 in summer, others 9–5, editor reads in ET.
- **Phase 2 (after Phase 1 verified):** historical +1 hr conversion; verify on a
  sample first.

## Out of scope
- Renaming DB columns (`dst_*` → `summer_*`).
- The Teramind/Monday date-bucket edge case (only differs within an hour of
  midnight; office hours never hit it).
