-- Add work_days column to schedules to support non-Mon-Fri shift configurations.
-- Stored as a comma-separated string of day abbreviations (e.g. 'Mon,Tue,Wed,Thu,Fri' or 'Sat,Sun').
-- Default covers the standard Monday-Friday workweek so existing schedules are unaffected.
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS work_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri';
