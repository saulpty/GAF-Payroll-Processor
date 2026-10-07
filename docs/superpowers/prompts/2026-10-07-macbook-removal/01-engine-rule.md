# Remove the MacBook-swap feature, step 1 of 2: the payroll engine rule

**Copy every edit exactly, character for character. Do not rewrite, reformat or renumber anything
else. If your context is compacted mid-task, re-read this prompt before writing.**

Saul (2026-10-07): the MacBook-swap flag was a one-time thing and must go. Nobody is flagged today
(0 of 55 employees), so removing the rule changes no paycheck: an employee with no Teramind data is
handled like everyone else (Step 5, "No data + no form"). Saul explicitly approved editing the two
payroll files below for this, and **only** for this.

**Only these three files may change:** `src/app/lib/classificationEngine.ts`,
`src/app/pages/ProcessPayroll.tsx`, `src/AGENTS.md`. No other file may be touched. The database
column `employees.is_macbook_swap` stays; do not write a migration.

## 1. `src/app/lib/classificationEngine.ts` — three edits, nothing else

**1a.** In `interface EmployeeRecord`, delete this one line:

```ts
  is_macbook_swap: boolean;
```

**1b.** In the doc comment that starts `Compute payroll_ready and status_current`, replace

```ts
 *   (a) initial_status is GREEN (clean day, outage, full-day perm, macbook-swap) — always ready, OR
```

with

```ts
 *   (a) initial_status is GREEN (clean day, outage, full-day perm) — always ready, OR
```

**1c.** Delete this whole block, including the blank line after it. Do **not** renumber Step 5,
Step 6 or Step 7, and do not change any other step:

```ts
      // ── Step 4: Macbook-swap, no Teramind data ──
      if (emp.is_macbook_swap && !tmEntry) {
        const entry = buildEntry({ ...baseEntry, entry_time: sched.start, exit_time: sched.end }, {
          event_type_1: '', pay_impact_1: '',
          event_type_2: '', pay_impact_2: '',
          documentation: '', notes: 'Macbook swap',
          auto_notes: 'Macbook swap — default schedule.',
          initial_status: 'GREEN',
        });
        results.push(entry);
        continue;
      }

```

## 2. `src/app/pages/ProcessPayroll.tsx` — one edit, nothing else

In `type Employee`, replace

```ts
  is_grace_list: boolean; is_macbook_swap: boolean;
```

with

```ts
  is_grace_list: boolean;
```

## 3. `src/AGENTS.md` — the classification step list

Delete this one line:

```md
5. **Macbook swap** with no Teramind data → schedule times, GREEN.
```

Then renumber the two items after it: `6. **No data and no form**` becomes `5. **No data and no form**`,
and `7. **Normal day with data**` becomes `6. **Normal day with data**`. Nothing else in that list
changes.

When done, reply with a one-line summary per file.
