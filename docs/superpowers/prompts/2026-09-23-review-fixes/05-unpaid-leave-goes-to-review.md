# 05 — Unpaid permissions and Floating Holiday / Birthday days go to Action Required

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these two files may change. No other file may be touched.**

- `src/app/lib/classificationEngine.ts` — one small addition in the full-day-permission branch
- `src/AGENTS.md` — one bullet in "Decision order in `runClassificationEngine`", nothing else

Saul (the owner) asked for this fix. Do not create files. Do not touch any page, action,
migration, test or other lib. Do not reformat anything you are not asked to change. Do not
rename or remove any existing export.

## The bug (reproduced 2026-09-23)

On 2026-08-27 Saul asked that two kinds of permission go to the operator for review instead of
auto-resolving: any **unpaid** permission (`Permiso No remunerado`, which docks a full day), and
**Floating Holiday / Birthday Day Off**. The full-day-permission branch of
`runClassificationEngine` does set `initial_status: 'YELLOW'` for them.

But the same branch also pre-fills `event_type_1` and `pay_impact_1`, and `buildEntry` runs
`computeDerivedFields`, which treats "YELLOW with event and impact both filled" as *already
resolved*. So the rows are written `payroll_ready = 'YES'`, `status_current = 'GREEN'`. Action
Required loads only `payroll_ready = 'NO'`, so these rows never appear there and nobody reviews
them. Today, for a scheduled Monday covered by one permission and nothing else:

```
'Permiso No remunerado' → event 'Permiso No remunerado', impact 'Unpaid', discount 480,
                          initial YELLOW, payroll_ready 'YES', status_current 'GREEN'   ← wrong
'Floating Holiday'      → event 'Permiso Remunerado', impact 'Floating Holiday / B-Day Off',
                          initial YELLOW, payroll_ready 'YES', status_current 'GREEN'   ← wrong
```

Both should be `payroll_ready 'NO'`, `status_current 'YELLOW'`.

## 1. `src/app/lib/classificationEngine.ts` — hold YELLOW permissions for review

In `runClassificationEngine`, in the block headed `// ── Step 2: Full-day permission ──`,
find exactly this (it is the end of the `if (fullDayPerm) { … }` block):

```ts
        const permStatus = (isTftPerm || isFloatingOrBday || isUnpaidPerm) ? 'YELLOW' : 'GREEN';
        const entry = buildEntry({ ...baseEntry }, {
          event_type_1: et1, pay_impact_1: pi1,
          event_type_2: '', pay_impact_2: '',
          documentation: 'Permission Form', notes: '',
          auto_notes: `Permission: ${fullDayPerm.requestType}${isTftPerm ? ' — TFT on file, operator must review.' : ''}`,
          initial_status: permStatus,
        });
        results.push(entry);
        continue;
      }
```

Replace it with this — the only change is the four new lines between `});` and
`results.push(entry);`:

```ts
        const permStatus = (isTftPerm || isFloatingOrBday || isUnpaidPerm) ? 'YELLOW' : 'GREEN';
        const entry = buildEntry({ ...baseEntry }, {
          event_type_1: et1, pay_impact_1: pi1,
          event_type_2: '', pay_impact_2: '',
          documentation: 'Permission Form', notes: '',
          auto_notes: `Permission: ${fullDayPerm.requestType}${isTftPerm ? ' — TFT on file, operator must review.' : ''}`,
          initial_status: permStatus,
        });
        // A YELLOW permission is held for the operator even though event and impact are
        // pre-filled as a suggestion: computeDerivedFields would call it resolved (YES/GREEN)
        // and Action Required, which loads only payroll_ready = 'NO', would never show it.
        if (permStatus === 'YELLOW') { entry.payroll_ready = 'NO'; entry.status_current = 'YELLOW'; }
        results.push(entry);
        continue;
      }
```

That is the whole engine change. Specifically:

- **Keep** `event_type_1` and `pay_impact_1` pre-filled exactly as they are now. They are the
  suggestion the operator accepts or changes.
- **Keep** `discount_total_minutes` exactly as `buildEntry` computes it (480 for an unpaid
  permission, 0 for Floating Holiday / Birthday). Do not set it to 0 and do not change it.
- **Do not change `computeDerivedFields`, `computeDiscount` or `buildEntry`.** When the operator
  saves the row in Action Required, `saveRow` calls `computeDerivedFields` with the row's own
  values, and with event and impact filled that returns `YES` / `GREEN` — which is exactly what
  must happen on save.
- Do not change `PAID_PERM_TYPES`, `UNPAID_PERM_TYPES`, `permStatus`, `et1`, `pi1`, any
  `auto_notes` string, or any other step (holiday, off-day, absence, macbook swap, no-data,
  tardiness, early leave). Ordinary PTO / Vacation / Compensatory Day stay GREEN and
  auto-resolve. Time for Time already comes out `NO` / `YELLOW` (blank impact) and is unchanged.

## 2. `src/AGENTS.md` — correct the one bullet that describes this step

Under `### Decision order in \`runClassificationEngine\``, find exactly this bullet:

```
3. **Full-day permission** (Monday Permissions board) → `PTO` /
   `Permiso Remunerado` / `Permiso No remunerado`, GREEN — except Time-for-Time,
   which is YELLOW.
```

Replace it with:

```
3. **Full-day permission** (Monday Permissions board) → `PTO` /
   `Permiso Remunerado` / `Permiso No remunerado`. Ordinary PTO and paid
   permissions are GREEN. Time-for-Time, unpaid permissions and Floating
   Holiday / Birthday days are YELLOW and held at `payroll_ready = 'NO'` so they
   go to Action Required, with event and pay impact pre-filled as a suggestion.
```

Nothing else in `src/AGENTS.md` changes.

## Acceptance

- Process a period in which someone has a **Permiso No remunerado** day on a scheduled work day
  with no punches. That day shows in **Action Required's YELLOW list**, with event
  `Permiso No remunerado` and pay impact `Unpaid` already filled in, and a discount of 480.
  Selecting it and committing it **unchanged** moves it to "Committed to GREEN".
- A **Floating Holiday** or **Birthday Day Off** day behaves the same way: YELLOW list, event
  `Permiso Remunerado`, pay impact `Floating Holiday / B-Day Off`, discount 0; committing it
  unchanged makes it GREEN.
- A **PTO** / **Vacation** day still does *not* appear in Action Required — it is GREEN in
  Payroll Master straight away.
- `src/app/lib/classificationEngine.ts` and `src/AGENTS.md` are the only files changed.
