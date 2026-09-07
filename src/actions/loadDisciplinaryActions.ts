import { action } from '@uibakery/data';

function loadDisciplinaryActions() {
  return action('loadDisciplinaryActions', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT id,
             ref,
             manager_name,
             manager_email,
             employee_name,
             employee_role,
             employee_branch,
             document_date::text        AS document_date,
             revaluation_date::text     AS revaluation_date,
             warning_level,
             final_outcome,
             scenario,
             q_expected,
             q_happened,
             q_when,
             q_impact,
             evidence_types,
             evidence_description,
             prior_warnings,
             expectations,
             consequences,
             signature_drawn,
             closed_at::text            AS closed_at,
             closed_by,
             closure_note,
             submitted_at::text         AS submitted_at
      FROM disciplinary_actions
      WHERE ({{params.manager}} IS NULL OR {{params.manager}} = '' OR manager_name = {{params.manager}})
        AND ({{params.employeeName}} IS NULL OR {{params.employeeName}} = '' OR employee_name = {{params.employeeName}})
      ORDER BY employee_name, document_date DESC, id DESC;
    `,
  });
}

export default loadDisciplinaryActions;
