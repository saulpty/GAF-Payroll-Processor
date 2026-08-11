-- Fix entry_time and exit_time values incorrectly stored as AM instead of PM
-- for Planilla 2 Junio 2026. The AM/PM parser bug caused times like "2:06 PM"
-- to be saved as "2:06 AM". This corrects all affected rows.

UPDATE payroll_entries
SET entry_time = replace(entry_time, ' AM', ' PM')
WHERE period_name ILIKE '%2 junio%'
  AND entry_time ~ '^[1-9]:[0-9]{2} AM$';

UPDATE payroll_entries
SET exit_time = replace(exit_time, ' AM', ' PM')
WHERE period_name ILIKE '%2 junio%'
  AND exit_time ~ '^[1-9]:[0-9]{2} AM$';
