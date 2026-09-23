# 08 — HRK Summary: take doctor-note and sick-day hours off once, not twice

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may change. No other file may be touched.**

- `src/actions/loadHrkSummary.ts`

Saul (the owner) asked for this fix. Do not create files. Do not touch any page (including
`src/app/pages/HrkSummary.tsx`), any other action, migration, test or lib. Do not reformat
anything you are not asked to change. Make exactly the three edits below and nothing else.

## The bug (found 2026-09-23)

The HRK Summary is the hours file sent to the payroll consultant. For each employee it computes

```
total_worked_hours = base_hours − total_discount_hours − incapacidad_hours − constancia_hours
```

Each of those three deductions is supposed to be a *different* slice of the day. Two of them
overlap:

**Constancia Médica (doctor's note).** `total_discount_hours` sums `discount_total_minutes` over
every row, Constancia rows included. But `constancia_hours_entry` also sets a Constancia row's
doctor hours to `discount_total_minutes / 60` whenever discount is above 0. So the same minutes
are subtracted once as discount and again as doctor hours.

Those discount minutes are never the doctor's time. `computeDiscount` in
`src/app/lib/classificationEngine.ts` never discounts a `Constancia Medica` slot. It is not one of
the unpaid impacts. Discount on a Constancia row can only come from the *other* slot (an
`Ausencia Injustificada` / `Unpaid` remainder, `Tardanza` / `Unpaid…`, or `Salida Temprano`), or from
a hand-entered or imported value. By definition, it is the **unpaid** part of the day.

**Incapacidad (sick day).** `incapacidad_hours` takes a flat 8 h off for every Incapacidad row.
`computeDiscount` never discounts an `Incapacidad` slot either. So any discount minutes on that
same row are the same day being taken off a second time.

Real rows (from `src/migrations/1781275100_import_excel_operator_resolved.sql`, the operator-
resolved import):

| Employee, period, day | Discount | Tag | Note on the row |
|---|---|---|---|
| Jennette Torrano, Q2-Mar-2026, Mar 20 | 240 | Constancia Medica | `8am - 11am` |
| Ángela Rodgers, Q1-Apr-2026, Apr 8 | 420 | Constancia Medica | `Constancia por 4 horas, Descontar las otras 4` |
| Ángela Rodgers, Q2-Apr-2026, Apr 15 | 240 | Constancia Medica | `4 hours` |
| Ángela Rodgers, Q1-May-2026, May 6 | 420 | Incapacidad | `Reason: Sick, do not discount 420 minutes as this is a sick day.` |
| Jeanine Puyol, Q2-May-2026, May 11 | 420 | Incapacidad | `Doctor note will apply in this case so make sure to not deduct the minutes but rather place this day as Incapacidad` |

The Torrano row shows what the discount means. The paid day is 7 h (the flat 420 policy). The
note covers 8–11 am, which is 3 h. 7 − 3 = 4 h = **240**, exactly the discount the operator
entered. So the discount is the unpaid remainder, and the doctor hours are the 3 h in the note.
Today the report shows 4 h of doctor time, which is the unpaid part counted a second time.

## Why this rule (plain terms)

Every hour of a day should land in exactly one bucket: worked, unpaid (discount), doctor note, or
sick day.

- **Doctor-note hours come only from the time written in the note.** Discount minutes on that
  row stay where they are, as the unpaid part. If the note has no readable time range, the
  doctor hours for that day are 0. The ⚠ review flag then goes up so Tim checks the note.
- **A sick day is the flat 8 h and nothing else.** Discount minutes on an Incapacidad row are
  not counted again.

When the file can't tell, it now errs toward *not* docking the employee twice. At worst a few
paid doctor hours show up under "worked" instead of "constancia", with a flag on them. Today
the error goes the other way: 4 to 8 hours per day are taken out of pay that should not be.

### Before → after, the five real rows (hours taken off worked for that one day)

| Row | Before: discount + doctor + sick = off | After: discount + doctor + sick = off | ⚠ flag |
|---|---|---|---|
| Torrano, Mar 20 | 4 + 4 + 0 = **8** | 4 + 3 + 0 = **7** | no (note is readable) |
| Rodgers, Apr 8 | 7 + 7 + 0 = **14** | 7 + 0 + 0 = **7** | **yes** — note has no time range |
| Rodgers, Apr 15 | 4 + 4 + 0 = **8** | 4 + 0 + 0 = **4** | **yes** — note has no time range |
| Rodgers, May 6 | 7 + 0 + 8 = **15** | 0 + 0 + 8 = **8** | no |
| Puyol, May 11 | 7 + 0 + 8 = **15** | 0 + 0 + 8 = **8** | no |

Rodgers Apr 8's note says "4 h doctor, dock the other 4". Her stored discount of 420 disagrees
with the note, and that is a data question for Tim, not something this query should guess at.
The flag puts it in front of him.

## 1. `constancia_hours_entry` — never take doctor hours from discount minutes

Find exactly this:

```sql
      -- Constancia hours: prefer discount_total_minutes; else parse note time range
      -- Tested patterns: "constancia de 9am - 11am" -> 2h, "Constancia desde 11am a 1:30pm" -> 2.5h
      -- Uses space( *) not \s to avoid template-literal escape issues
      entries_with_constancia AS (
        SELECT
          ef.*,
          CASE
            -- Has Constancia Medica pay impact AND discount minutes set
            WHEN (ef.pay_impact_1 = 'Constancia Medica' OR ef.pay_impact_2 = 'Constancia Medica')
              AND ef.discount_total_minutes > 0
            THEN ef.discount_total_minutes::numeric / 60.0

            -- Has Constancia Medica pay impact, no minutes -> parse time range from note
            WHEN (ef.pay_impact_1 = 'Constancia Medica' OR ef.pay_impact_2 = 'Constancia Medica')
              AND ef.discount_total_minutes = 0
              AND ef.notes ~ '[0-9]{1,2}(:[0-9]{2})? *[ap]m *[-a] *[0-9]{1,2}(:[0-9]{2})? *[ap]m'
            THEN (
```

Replace it with this:

```sql
      -- Constancia hours come ONLY from the time range written in the note, never from
      -- discount_total_minutes. computeDiscount never discounts a 'Constancia Medica' slot,
      -- so discount minutes on a Constancia row are the UNPAID part of the day and are
      -- already subtracted once via discount_agg.
      -- Tested patterns: "constancia de 9am - 11am" -> 2h, "Constancia desde 11am a 1:30pm" -> 2.5h
      -- Uses space( *) not \s to avoid template-literal escape issues
      entries_with_constancia AS (
        SELECT
          ef.*,
          CASE
            -- Has Constancia Medica pay impact -> parse time range from note
            WHEN (ef.pay_impact_1 = 'Constancia Medica' OR ef.pay_impact_2 = 'Constancia Medica')
              AND ef.notes ~ '[0-9]{1,2}(:[0-9]{2})? *[ap]m *[-a] *[0-9]{1,2}(:[0-9]{2})? *[ap]m'
            THEN (
```

The two changes are: the first `WHEN … THEN ef.discount_total_minutes::numeric / 60.0` branch is
removed, and the line `AND ef.discount_total_minutes = 0` is removed from the note-parsing
branch. Everything from `THEN (` down to `END AS constancia_hours_entry,` stays **exactly** as it
is. That includes every regex, every `REGEXP_REPLACE`, every `'\\1'` / `'\\2'`, and the
`ELSE 0`.

## 2. `needs_constancia_review` — flag a doctor-note day whose hours can't be read

Find exactly this:

```sql
          -- Flag: note mentions constancia but row is NOT tagged Constancia Medica
          CASE
            WHEN ef.notes ILIKE '%constancia%'
              AND COALESCE(ef.pay_impact_1, '') != 'Constancia Medica'
              AND COALESCE(ef.pay_impact_2, '') != 'Constancia Medica'
            THEN TRUE
            ELSE FALSE
          END AS needs_constancia_review
```

Replace it with this:

```sql
          -- Flag: note mentions constancia but row is NOT tagged Constancia Medica,
          -- OR row is tagged Constancia Medica and has unpaid minutes but its note has no
          -- readable time range, so its doctor hours are unknown and shown as 0
          CASE
            WHEN ef.notes ILIKE '%constancia%'
              AND COALESCE(ef.pay_impact_1, '') != 'Constancia Medica'
              AND COALESCE(ef.pay_impact_2, '') != 'Constancia Medica'
            THEN TRUE
            WHEN (ef.pay_impact_1 = 'Constancia Medica' OR ef.pay_impact_2 = 'Constancia Medica')
              AND ef.discount_total_minutes > 0
              AND NOT COALESCE(ef.notes ~ '[0-9]{1,2}(:[0-9]{2})? *[ap]m *[-a] *[0-9]{1,2}(:[0-9]{2})? *[ap]m', FALSE)
            THEN TRUE
            ELSE FALSE
          END AS needs_constancia_review
```

The regex in the new branch is character-for-character the same as the one in edit 1. The
`COALESCE(…, FALSE)` makes a NULL note count as "not readable".

## 3. `discount_agg` — don't count discount minutes on a sick-day row

Find exactly this:

```sql
      discount_agg AS (
        SELECT
          employee_id,
          ROUND(SUM(discount_total_minutes)::numeric / 60, 2) AS total_discount_hours
        FROM entries_with_constancia
        GROUP BY employee_id
      ),
```

Replace it with this:

```sql
      -- An Incapacidad row is already taken off as a flat 8h in incapacidad_agg.
      -- Discount minutes on that same row would take the same day off a second time,
      -- so they are not counted. computeDiscount never discounts an 'Incapacidad' slot.
      discount_agg AS (
        SELECT
          employee_id,
          ROUND(SUM(
            CASE
              WHEN pay_impact_1 = 'Incapacidad' OR pay_impact_2 = 'Incapacidad' THEN 0
              ELSE discount_total_minutes
            END
          )::numeric / 60, 2) AS total_discount_hours
        FROM entries_with_constancia
        GROUP BY employee_id
      ),
```

## Out of scope — do NOT change

- **`base_hours` and the Mon–Sat rule** (`EXTRACT(DOW FROM d) BETWEEN 1 AND 6`). Saul ruled on
  2026-08-25 that this is the paid weekly rest day and is correct.
- **The final `SELECT`**, including the `total_worked_hours` formula (it still subtracts all
  three) and the `GREATEST(…, 0)` floor.
- **Note parsing.** Do not change any regex or `REGEXP_REPLACE`, and do not add parsing for
  "4 horas" / "4 hours". A note like Ángela's May 20 one currently comes out *negative*. That
  goes in a later prompt, together with negative hours.
- `incapacidad_agg`, `constancia_agg`, `notes_agg`, the PTO CTEs, `entries_filtered`,
  `period_bounds`, `employee_base`.
- `src/app/pages/HrkSummary.tsx`. Its ⚠ tooltip and banner say "mentions constancia but not
  tagged". A later page prompt will reword them.
- Any stored `payroll_entries` value. This is a read-only report query.
- Every `{{params.periodName}}` stays exactly where it is, bare and never inside quotes.

## Acceptance

**Before pasting**, open HRK Summary and write down these rows (Refresh after picking each
period): Ángela Rodgers in **Q1-Apr-2026**, **Q2-Apr-2026** and **Q1-May-2026**; Jennette Torrano
in **Q2-Mar-2026**; Jeanine Puyol in **Q2-May-2026**. For each one, note Worked, Discount,
Constancia hours, Constancia dates and the ⚠. After the change, hard-refresh (Ctrl+Shift+R),
then check:

- **Rodgers, Q1-Apr-2026:** Worked goes **up by exactly 7.00**, Constancia hours goes **down by
  7.00**, Discount is unchanged, `2026-04-08 (7.0h)` becomes `2026-04-08`, and ⚠ shows on her name.
- **Rodgers, Q2-Apr-2026:** Worked **+4.00**, Constancia hours **−4.00**, Discount unchanged,
  `2026-04-15 (4.0h)` becomes `2026-04-15`, and ⚠ shows.
- **Torrano, Q2-Mar-2026:** Worked **+1.00**, Constancia hours **−1.00**, Discount unchanged,
  and `2026-03-20 (4.0h)` becomes `2026-03-20 (3.0h)`.
- **Rodgers, Q1-May-2026:** Worked **+7.00**, Discount **−7.00**. Incapacidad days and dates
  are unchanged.
- **Puyol, Q2-May-2026:** Worked **+7.00**, Discount **−7.00**. Incapacidad is unchanged.
- In the **current** period, every employee's numbers are identical to before, unless they
  have a Constancia row with discount above 0 or an Incapacidad row with discount above 0.
  The read-only query below lists every such row. Run it in the UIB query runner **before**
  the change so you know which employees to expect to move:

  ```sql
  SELECT pe.period_name, e.display_name, SUBSTRING(pe.work_date FROM 1 FOR 10) AS day,
         pe.pay_impact_1, pe.pay_impact_2, pe.discount_total_minutes, pe.notes
  FROM payroll_entries pe JOIN employees e ON e.id = pe.employee_id
  WHERE pe.deleted_at IS NULL AND pe.discount_total_minutes > 0
    AND ('Constancia Medica' IN (pe.pay_impact_1, pe.pay_impact_2)
      OR 'Incapacidad' IN (pe.pay_impact_1, pe.pay_impact_2))
  ORDER BY pe.period_name, e.display_name, pe.work_date;
  ```

- `src/actions/loadHrkSummary.ts` is the only file changed, and `tests/hrkDoubleCount.test.ts`
  passes.
