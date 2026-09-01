# Why Johann Morante's State is blank — 2026-09-01

Asked by Saul after seeing one blank State on the new Contracts page.

**Answer: it is blank on the Monday board, not lost by our code — and the
Contracts mirror has not been synced in 13 days, so it may since have been
filled in.**

## Evidence

`state` comes from `monday_col_onboarding_state` = `lookup_mktc2x46`, a
**mirror** column on the Employee Onboarding board.

Reading the stored `raw` payload from the 2026-08-19 sync:

| employee | stored `state` | `raw.text` | `raw.display_value` |
|---|---|---|---|
| Carlos Aloma | `GA` | null | `GA` |
| Ulla Hees | `Vitasya` | null | `Vitasya` |
| **Johann Morante** | **(blank)** | null | **(empty string)** |

`text` is null for **all three**, including the two that display correctly.
Mirror columns always return `text: null` — which is exactly why
`colText` in `mondaySync.ts:92` reads `display_value ?? text`. The parser is
right. Johann's `display_value` is an empty string: Monday sent us nothing.

He is the only one of the 45 live board rows with a blank State.

## A correction to my own first attempt

The first probe (`prompts/2026-09-01-contracts/08-*.md`) selected `text` and
`value` and got null for everyone, which looked like a parsing bug and was
actually a badly written query — it never looked at `display_value`. Corrected
in `10-*.md`. **When checking a mirror column, read `display_value`.**

## The staleness, which matters as much

```
monday_contracts: 45 live rows, every one synced 2026-08-19 19:08:16 UTC
monday_sync_log.contracts: last_synced_at 2026-08-19 19:08:17 UTC, 45 items
```

**The Contracts board has not been synced for 13 days.** Johann started
2026-08-03 and sits in the board group `1 Months - 3 Months`, so he is a recent
hire whose State plausibly had not been set when we last looked.

## What to do

1. **Run *Sync now* on Contracts** (Admin → Employees → Monday) and see whether
   his State fills in. That answers it outright and costs nothing — the sync is
   an idempotent upsert from the board, which is the source of truth.
2. If it is still blank, **it is a Monday data-entry gap**: someone needs to set
   his State on the Onboarding board. Nothing to change in this repo.

The page already handles it correctly either way — a blank State renders `—`
and nothing breaks.

## Worth noting separately

Nothing re-syncs these mirrors on a schedule; they move only when a human
presses *Sync now*. Thirteen days of drift appeared without anyone noticing,
which is a reason the Contracts page could silently show stale positions,
states and contract end dates. Not fixed here; worth a decision about whether
these boards should sync automatically.

---

# Resolved — Saul re-synced, 2026-09-01 20:51 UTC

**It was staleness.** After the re-sync `blank_state` is 0 and Johann Morante
shows `GA` on the Contracts page. The mirror had simply not been refreshed since
2026-08-19; his State was set on the board at some point in those 13 days.

Nothing to change in the code. The parser was reading the right field all along.

**The real lesson is the 13 days, not the blank cell.** Nothing re-syncs these
mirrors on a schedule — they move only when a human presses *Sync now* — so the
Contracts page silently showed a stale State for almost two weeks and would have
done the same for a stale contract end date. Worth deciding whether these boards
should sync automatically.

Two things the re-sync also surfaced, both real:

- **Euclides Gonzalez exists twice in `employees`**, and his board row is
  attached to the deactivated record. See
  `2026-09-01-euclides-gonzalez-duplicate-employee.md`.
- A new State value, `GAF`, appeared, and the active roster moved 44 → 45.
