-- Phase 2: convert historical payroll_entries from Panama time to US Eastern.
--
-- During US DST, Eastern = Panama + 1 hour, so we shift the DISPLAY-time columns
-- (entry_time, exit_time, scheduled_start, scheduled_end, grace_until) by +1 hour
-- for every row whose workdate falls inside a US DST window. The relative columns
-- (late/early/discount) and all statuses/events/impacts are LEFT UNCHANGED — pay
-- is unaffected. Output format is normalized to 'H:MI AM'.
--
-- SAFETY:
--   * Guarded by classification_config.history_tz_converted='true' (won't re-run).
--   * Pay-safe (only display-time columns move).
--   * The +1hr logic is unit-tested in tests/shiftTime.test.ts (Node proxy).
--   * Reversible — see the REVERT block at the bottom (run manually if needed).
--
-- VERIFY after running (SELECT, no writes):
--   SELECT employee_id, work_date, entry_time, scheduled_start, scheduled_end
--   FROM payroll_entries WHERE period_name = 'Q2-Mar-2026'
--   ORDER BY employee_id, work_date LIMIT 15;
--   Expect times ~1hr later (an 8:12 AM entry -> 9:12 AM; Standard sched 9-5;
--   Favian sched 10-6).

DO $$
DECLARE
  v_rows integer;
BEGIN
  IF EXISTS (SELECT 1 FROM classification_config WHERE key = 'history_tz_converted' AND value = 'true') THEN
    RAISE NOTICE 'history_tz_converted already set - skipping +1hr conversion.';
    RETURN;
  END IF;

  UPDATE payroll_entries pe SET
    entry_time = CASE
      WHEN pe.entry_time IS NULL OR btrim(pe.entry_time) = '' THEN pe.entry_time
      WHEN pe.entry_time ~* '(am|pm)\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.entry_time), 'HH12:MI AM') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      WHEN pe.entry_time ~ '^\s*\d{1,2}:\d{2}(:\d{2})?\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.entry_time), 'HH24:MI:SS') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      ELSE pe.entry_time END,
    exit_time = CASE
      WHEN pe.exit_time IS NULL OR btrim(pe.exit_time) = '' THEN pe.exit_time
      WHEN pe.exit_time ~* '(am|pm)\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.exit_time), 'HH12:MI AM') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      WHEN pe.exit_time ~ '^\s*\d{1,2}:\d{2}(:\d{2})?\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.exit_time), 'HH24:MI:SS') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      ELSE pe.exit_time END,
    scheduled_start = CASE
      WHEN pe.scheduled_start IS NULL OR btrim(pe.scheduled_start) = '' THEN pe.scheduled_start
      WHEN pe.scheduled_start ~* '(am|pm)\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.scheduled_start), 'HH12:MI AM') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      WHEN pe.scheduled_start ~ '^\s*\d{1,2}:\d{2}(:\d{2})?\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.scheduled_start), 'HH24:MI:SS') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      ELSE pe.scheduled_start END,
    scheduled_end = CASE
      WHEN pe.scheduled_end IS NULL OR btrim(pe.scheduled_end) = '' THEN pe.scheduled_end
      WHEN pe.scheduled_end ~* '(am|pm)\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.scheduled_end), 'HH12:MI AM') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      WHEN pe.scheduled_end ~ '^\s*\d{1,2}:\d{2}(:\d{2})?\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.scheduled_end), 'HH24:MI:SS') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      ELSE pe.scheduled_end END,
    grace_until = CASE
      WHEN pe.grace_until IS NULL OR btrim(pe.grace_until) = '' THEN pe.grace_until
      WHEN pe.grace_until ~* '(am|pm)\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.grace_until), 'HH12:MI AM') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      WHEN pe.grace_until ~ '^\s*\d{1,2}:\d{2}(:\d{2})?\s*$' THEN regexp_replace(to_char(to_timestamp(btrim(pe.grace_until), 'HH24:MI:SS') + interval '1 hour', 'HH12:MI AM'), '^0', '')
      ELSE pe.grace_until END
  WHERE EXISTS (
    SELECT 1 FROM dst_calendar d
    WHERE left(pe.work_date, 10)::date >= d.us_dst_start
      AND left(pe.work_date, 10)::date <  d.us_dst_end
  );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'Shifted % payroll rows +1hr (Panama -> US Eastern).', v_rows;

  INSERT INTO classification_config (key, value, label, description, value_type, category)
  VALUES ('history_tz_converted', 'true', 'History converted to US Eastern',
          'Marker: historical payroll_entries times shifted +1hr (Panama->US Eastern). Prevents re-run.',
          'boolean', 'internal')
  ON CONFLICT (key) DO UPDATE SET value = 'true';
END $$;

-- ============================================================================
-- REVERT (manual — run only if the conversion looks wrong). Restores Panama time
-- by shifting the same columns/rows -1 hour and clearing the marker:
--
-- UPDATE payroll_entries pe SET
--   entry_time      = regexp_replace(to_char(to_timestamp(btrim(pe.entry_time),      'HH12:MI AM') - interval '1 hour', 'HH12:MI AM'), '^0', ''),
--   exit_time       = regexp_replace(to_char(to_timestamp(btrim(pe.exit_time),       'HH12:MI AM') - interval '1 hour', 'HH12:MI AM'), '^0', ''),
--   scheduled_start = regexp_replace(to_char(to_timestamp(btrim(pe.scheduled_start), 'HH12:MI AM') - interval '1 hour', 'HH12:MI AM'), '^0', ''),
--   scheduled_end   = regexp_replace(to_char(to_timestamp(btrim(pe.scheduled_end),   'HH12:MI AM') - interval '1 hour', 'HH12:MI AM'), '^0', ''),
--   grace_until     = regexp_replace(to_char(to_timestamp(btrim(pe.grace_until),     'HH12:MI AM') - interval '1 hour', 'HH12:MI AM'), '^0', '')
-- WHERE EXISTS (SELECT 1 FROM dst_calendar d
--   WHERE left(pe.work_date,10)::date >= d.us_dst_start AND left(pe.work_date,10)::date < d.us_dst_end)
--   AND pe.entry_time ~* '(am|pm)\s*$';  -- by now all times are 'H:MI AM' format
-- DELETE FROM classification_config WHERE key = 'history_tz_converted';
-- ============================================================================
