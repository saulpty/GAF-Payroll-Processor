-- One-time cleanup: delete 5 test rows by ref
DELETE FROM disciplinary_actions
WHERE ref IN (
  'GAF-DA-2026-6734',
  'GAF-DA-2026-3037',
  'GAF-DA-2026-3072',
  'GAF-DA-2026-8248',
  'GAF-DA-2026-5432'
);
