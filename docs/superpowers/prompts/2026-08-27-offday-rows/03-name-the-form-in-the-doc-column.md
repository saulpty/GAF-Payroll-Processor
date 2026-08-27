# The DOC column must say WHICH form was submitted

Two files, and no others:

- **new** `src/migrations/1781986500_seed_form_documentation_options.sql`
- `src/app/lib/classificationEngine.ts`

## Why

The DOC column reads `Form Submitted` on rows produced by three *different*
Monday boards, so an operator looking at a row cannot tell which form to go read.
The engine writes that same literal from three separate branches, and by the
time it does, the matched row has been reduced to a boolean.

The business runs three distinct forms:

| Board | What it carries |
|---|---|
| Permissions & Requests | PTO / Vacation, Floating Holiday, Birthday Day Off, WFH, Time for Time |
| GAF Attendance | Tardiness and Absence, with a reason (sickness lives here) |
| Time Adjustments | Time-for-Time / late-time payback |

## 1. The migration

Seed three new values into `documentation_options`, following the shape of the
existing seed in `1781189300_gaf_planilla_initial.sql:257-265`:

```sql
INSERT INTO documentation_options (name) VALUES
  ('Permission Form'),
  ('Attendance Form'),
  ('Time Adjustment Form')
ON CONFLICT (name) DO NOTHING;
```

**Do not remove or rename `Form Submitted`.** Existing rows carry it and the
operator must still be able to pick it.

Give the file a real header comment describing what it does — and unlike
`1781900300`, make sure that comment describes *this* change.

## 2. Engine — say which board the match came from

`documentation` is a `<select>` over `documentation_options`, so it may only
ever be set to one of the seeded values.

**a. Full-day permission branch** (currently around line 576, the
`documentation: 'Form Submitted'` inside `if (fullDayPerm)`):

change it to `documentation: 'Permission Form'`.

**b. Absence-form branch** (currently around line 592):

```ts
const doc = isSick ? 'Doctor Note – Pending' : 'Form Submitted';
```

becomes

```ts
const doc = isSick ? 'Doctor Note – Pending' : 'Attendance Form';
```

Leave the `Doctor Note – Pending` half exactly as it is.

**c. Tardiness branch on a normal working day.** `hasTft` (around line 672) is
currently a single boolean OR-ing two different boards together. Split it so the
source is known, keeping the matching strings exactly as they are:

```ts
      const tftAdjustment = adjustments.some(a => {
          const t = a.adjustmentType.toLowerCase();
          return t.includes('time for time') || t.includes('tft') || t.includes('time adjustment') || t.includes('late time payback');
        });
      const tftPermission = permissions.some(p => {
          const t = p.requestType.toLowerCase();
          return t.includes('time for time') || t.includes('tft');
        });
      const hasTft = tftAdjustment || tftPermission;
```

`hasTft` keeps its exact current meaning and every existing use of it stays
untouched. Then replace the single line at the end of the tardiness block
(currently `if (hasTardForm) doc = 'Form Submitted';`) with:

```ts
        if (tftAdjustment) doc = 'Time Adjustment Form';
        else if (tftPermission) doc = 'Permission Form';
        else if (hasTardForm) doc = 'Attendance Form';
```

The TFT source comes first because it is what drove the row to YELLOW — that is
the form the operator needs to open.

## 3. A Floating Holiday must stop looking like an ordinary permission

In the same `if (fullDayPerm)` branch, anything that is not PTO/Vacation and not
unpaid currently lands as `Permiso Remunerado` / `Paid`. A Floating Holiday and
a Birthday Day Off are therefore indistinguishable from a generic paid
permission in the two columns payroll actually reads.

`Floating Holiday / B-Day Off` already exists as a seeded value in `pay_impacts`
(`1781189300:236-254`) and the engine has never once emitted it.

Inside the `if (!isUnpaidPerm)` block, alongside the existing PTO and
time-for-time cases, add: when the lowercased request type contains
`floating`, `birthday` or `b-day`, set `pay_impact_1` to
`'Floating Holiday / B-Day Off'`. Leave `event_type_1` as `Permiso Remunerado`.

## 4. The two permission types that can cost a day's pay go to the operator

`initial_status` in that branch is currently `isTftPerm ? 'YELLOW' : 'GREEN'`.

Make it YELLOW for **three** cases and GREEN otherwise:

- Time for Time (as today)
- Floating Holiday / Birthday Day Off (the case from item 3)
- any **unpaid** permission (`isUnpaidPerm`)

Ordinary PTO and ordinary paid permissions stay GREEN and keep auto-resolving —
do not change those. Saul asked for exactly these three and no more.

## Do not touch

- **No other file.** Not `ProcessPayroll.tsx`, not any action, not any page, not
  any test, not the other migrations.
- Do not change the off-day branch added earlier today — it deliberately does
  not look at forms at all, and must keep `documentation: ''`.
- Do not change `PAID_PERM_TYPES` or `UNPAID_PERM_TYPES`.
- Do not change any `auto_notes` string.
- Do not change the holiday, outage, macbook-swap, no-data or early-leave
  branches, or any discount, grace, late or early calculation.
- Do not remove any existing `documentation_options` value.

## Acceptance criteria

- No row is written with `documentation: 'Form Submitted'` any more; each
  instead names the board it came from.
- A Floating Holiday request produces `Permiso Remunerado` with pay impact
  `Floating Holiday / B-Day Off`, status YELLOW.
- An unpaid permission produces `Permiso No remunerado` / `Unpaid`, YELLOW.
- An ordinary PTO request is unchanged: `PTO` / `Paid`, GREEN.
- A tardiness with only an attendance form reads `Attendance Form`; one with a
  Time Adjustments row reads `Time Adjustment Form`.
- A sick absence still reads `Doctor Note – Pending`.
- The existing test suite still passes — nothing in it should need editing.

Then confirm every identifier used in each file is imported.
