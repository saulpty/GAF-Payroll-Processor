-- 2026-09-10. A period was run twice under "Q1-Aug-2026" and "Q1-Aug-20260".
-- From now on a period name must have the canonical shape. NOT VALID so the
-- two legacy free-text names ("Test Period May 25th - Jun 10th",
-- "Planilla 2 Junio 2026 11-19") stay; new and renamed rows are checked.
-- Rollback: ALTER TABLE periods DROP CONSTRAINT periods_name_shape;
ALTER TABLE periods
  ADD CONSTRAINT periods_name_shape
  CHECK (period_name ~ '^Q[12]-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-[0-9]{4}$')
  NOT VALID;
