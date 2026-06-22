-- Fix auto_notes for late entries in the two TZ-corrected periods.
-- Migration 1781401100 corrected entry/exit times and late_minutes but preserved
-- the old auto_notes for late rows. This migration rebuilds them with correct counts.
-- Only touches auto-resolved entries (resolved_by IS NULL) with late_minutes > 0.

UPDATE payroll_entries pe
SET
  auto_notes = CASE
    WHEN pe.late_minutes > 0 AND pe.early_leave_minutes = 0 AND pe.documentation = 'Form Submitted'
      THEN 'Late ' || pe.late_minutes || ' min. Form filed. Auto-resolved: Unpaid (without Grace).'
    WHEN pe.late_minutes > 0 AND pe.early_leave_minutes = 0
      THEN 'Late ' || pe.late_minutes || ' min. No form. Auto-resolved: Unpaid (without Grace).'
    WHEN pe.late_minutes > 0 AND pe.early_leave_minutes > 0 AND pe.documentation = 'Form Submitted'
      THEN 'Late ' || pe.late_minutes || ' min. Form filed. Auto-resolved: Unpaid (without Grace).'
    WHEN pe.late_minutes > 0 AND pe.early_leave_minutes > 0
      THEN 'Late ' || pe.late_minutes || ' min. No form. Auto-resolved: Unpaid (without Grace).'
    ELSE pe.auto_notes
  END,
  updated_at = NOW()
WHERE pe.period_name IN ('Test Period May 25th - Jun 10th', 'Planilla 2 Junio 2026 11-19')
  AND pe.late_minutes > 0
  AND pe.resolved_by IS NULL;
