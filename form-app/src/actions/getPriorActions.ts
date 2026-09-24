import { action } from '@uibakery/data';

// Returns all prior disciplinary actions for a given employee, newest first
function getPriorActions() {
  return action('getPriorActions', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT
        id, ref, document_date, warning_level, final_outcome,
        scenario, q_expected, q_happened, q_when, q_impact,
        expectations, consequences, evidence_types, evidence_description,
        prior_warnings, manager_name, manager_email,
        pdf_en_base64, pdf_es_base64, submitted_at
      FROM disciplinary_actions
      WHERE employee_name = {{params.employeeName}}
        AND deleted_at IS NULL
      ORDER BY document_date DESC, submitted_at DESC;
    `,
  });
}

export default getPriorActions;
