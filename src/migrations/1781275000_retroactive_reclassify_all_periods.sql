-- ============================================================
-- Retroactive reclassification — apply updated engine rules
-- to ALL existing payroll_entries across all periods.
-- Safe to re-run: only touches rows where the old logic differs.
-- ============================================================

-- ── 1. TFT entries wrongly auto-resolved to GREEN ────────────
-- Old migration blindly applied "Unpaid (without Grace)" to ALL Tardanza rows
-- including ones that had "TFT on file" in auto_notes.
-- New rule: TFT ≤ 30 min → YELLOW (verify), TFT > 30 min → RED (operator review).

-- 1a. TFT + late > 30 min → RED, clear pay_impact for operator
UPDATE payroll_entries
SET
  pay_impact_1   = '',
  initial_status = 'RED',
  status_current = 'RED',
  payroll_ready  = 'NO',
  auto_notes     = regexp_replace(auto_notes, ' \[Reclassified:[^\]]+\]', '', 'g')
                   || ' [Retro: TFT + late >30 min → RED for review]'
WHERE event_type_1 = 'Tardanza'
  AND auto_notes ILIKE '%TFT on file%'
  AND auto_notes ILIKE '%Reclassified%'
  AND late_minutes > 30;

-- 1b. TFT + late ≤ 30 min → YELLOW, clear pay_impact for operator to verify
UPDATE payroll_entries
SET
  pay_impact_1   = '',
  initial_status = 'YELLOW',
  status_current = 'YELLOW',
  payroll_ready  = 'NO',
  auto_notes     = regexp_replace(auto_notes, ' \[Reclassified:[^\]]+\]', '', 'g')
                   || ' [Retro: TFT on file ≤30 min → YELLOW, verify]'
WHERE event_type_1 = 'Tardanza'
  AND auto_notes ILIKE '%TFT on file%'
  AND auto_notes ILIKE '%Reclassified%'
  AND late_minutes <= 30;

-- ── 2. Grace-list: YELLOW "no form" entries → auto-resolve GREEN/Unpaid ────
-- Old engine set grace-list + no form → YELLOW. New policy: same as non-grace → GREEN/Unpaid.
UPDATE payroll_entries pe
SET
  pay_impact_1   = 'Unpaid (without Grace)',
  initial_status = 'GREEN',
  status_current = 'GREEN',
  payroll_ready  = 'YES',
  discount_total_minutes = late_minutes,
  auto_notes     = regexp_replace(auto_notes, ' \[Reclassified:[^\]]+\]', '', 'g')
                   || ' [Retro: grace-list no-form → auto-resolved Unpaid (without Grace)]'
FROM employees e
WHERE pe.employee_id = e.id
  AND e.is_grace_list = TRUE
  AND pe.event_type_1 = 'Tardanza'
  AND pe.initial_status = 'YELLOW'
  AND pe.auto_notes ILIKE '%NO FORM%'
  AND pe.auto_notes NOT ILIKE '%TFT%';

-- ── 3. Grace-list: YELLOW with form + within grace minutes → Paid (Grace), GREEN ──
UPDATE payroll_entries pe
SET
  pay_impact_1   = 'Paid (Grace)',
  initial_status = 'GREEN',
  status_current = 'GREEN',
  payroll_ready  = 'YES',
  discount_total_minutes = 0,
  auto_notes     = regexp_replace(auto_notes, ' \[Reclassified:[^\]]+\]', '', 'g')
                   || ' [Retro: grace-list + form + within grace → Paid (Grace)]'
FROM employees e
JOIN schedules s ON s.id = e.schedule_id
WHERE pe.employee_id = e.id
  AND e.is_grace_list = TRUE
  AND pe.event_type_1 = 'Tardanza'
  AND pe.initial_status = 'YELLOW'
  AND pe.auto_notes ILIKE '%form filed%'
  AND pe.late_minutes <= s.grace_minutes
  AND pe.auto_notes NOT ILIKE '%TFT%';

-- ── 4. Refresh period summary counts ─────────────────────────
UPDATE periods p
SET
  green_count  = sub.green_count,
  yellow_count = sub.yellow_count,
  red_count    = sub.red_count
FROM (
  SELECT
    period_name,
    COUNT(*) FILTER (WHERE initial_status = 'GREEN')  AS green_count,
    COUNT(*) FILTER (WHERE initial_status = 'YELLOW') AS yellow_count,
    COUNT(*) FILTER (WHERE initial_status = 'RED')    AS red_count
  FROM payroll_entries
  GROUP BY period_name
) sub
WHERE p.period_name = sub.period_name;
