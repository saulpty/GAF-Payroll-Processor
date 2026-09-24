-- Four disciplinary actions created while testing the form, filed by the owner
-- against Timothy Moore. Content captured before deletion; see the HR Hub repo,
-- docs/findings/2026-09-07-timothy-moore-test-rows-deleted.md
DELETE FROM disciplinary_actions
WHERE id IN (12, 13, 14, 17)
  AND employee_name = 'Timothy Moore';
