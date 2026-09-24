import { action } from '@uibakery/data';

// Saves a Hub edit of one disciplinary action (Tim and Saul only: the EXISTS
// on disciplinary_admins is checked in the database). Employee, manager and
// ref are NOT editable; to change who a warning is about, delete it and file a
// new one. The first edit copies the filed PDF into pdf_en_original_base64
// (COALESCE keeps it on later edits); the new PDF is built in the browser.
// Zero rows returned = not allowed, or the action was deleted meanwhile.
function updateDisciplinaryAction() {
  return action('updateDisciplinaryAction', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET document_date          = {{params.documentDate}}::date,
          revaluation_date       = {{params.revaluationDate}}::date,
          warning_level          = {{params.warningLevel}},
          final_outcome          = {{params.finalOutcome}},
          scenario               = {{params.scenario}},
          q_expected             = {{params.qExpected}},
          q_happened             = {{params.qHappened}},
          q_when                 = {{params.qWhen}},
          q_impact               = {{params.qImpact}},
          evidence_types         = ARRAY(SELECT jsonb_array_elements_text({{params.evidenceTypes}}::jsonb)),
          evidence_description   = {{params.evidenceDescription}},
          prior_warnings         = {{params.priorWarnings}},
          expectations           = {{params.expectations}},
          consequences           = {{params.consequences}},
          employee_role          = {{params.employeeRole}},
          employee_branch        = {{params.employeeBranch}},
          pdf_en_original_base64 = COALESCE(pdf_en_original_base64, pdf_en_base64),
          pdf_en_base64          = {{params.pdf}},
          edited_at              = NOW(),
          edited_by              = lower(btrim({{ user.email }}))
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM disciplinary_admins a WHERE a.email = lower(btrim({{ user.email }})))
      RETURNING id, ref, manager_email, manager_name, employee_name;
    `,
  });
}

export default updateDisciplinaryAction;
