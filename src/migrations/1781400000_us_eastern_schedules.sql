-- US-Eastern-native schedules (Phase 1).
-- The schedule time columns are reinterpreted as US Eastern:
--   dst_*      = Summer (ET) pair
--   standard_* = Winter (ET) pair
-- The engine now picks summer during US DST and winter otherwise, with NO
-- conversion (stored value == displayed value).
--
-- Set the three known schedules explicitly to their correct US-Eastern values.
-- Explicit SET (not arithmetic) is idempotent and corrects any drifted rows.

UPDATE schedules
   SET dst_start = '9:00 AM',  dst_end = '5:00 PM',
       standard_start = '9:00 AM', standard_end = '5:00 PM',
       notes = 'Eastern-synced: 9-5 US Eastern year-round.'
 WHERE schedule_name = 'Standard';

UPDATE schedules
   SET dst_start = '9:00 AM',  dst_end = '4:00 PM',
       standard_start = '9:00 AM', standard_end = '4:00 PM',
       notes = '9-4 US Eastern year-round (ends 1 hr early).'
 WHERE schedule_name = 'Monique Luque schedule';

UPDATE schedules
   SET dst_start = '10:00 AM', dst_end = '6:00 PM',
       standard_start = '9:00 AM', standard_end = '5:00 PM',
       notes = 'Arizona team (no US DST): 10-6 ET in summer, 9-5 ET in winter.'
 WHERE schedule_name = 'Favian Fortune schedule';
