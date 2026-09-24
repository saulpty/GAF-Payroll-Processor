import { action } from '@uibakery/data';

function saveSubmission() {
  return action('saveSubmission', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      INSERT INTO disciplinary_actions (
        ref, manager_name, manager_email,
        employee_name, employee_role, employee_branch,
        document_date, revaluation_date,
        warning_level, final_outcome, scenario,
        q_expected, q_happened, q_when, q_impact,
        evidence_types, evidence_description,
        prior_warnings, expectations, consequences,
        signature_drawn,
        pdf_en_base64, pdf_es_base64
      )
      VALUES (
        {{params.ref}}, {{params.manager_name}}, {{params.manager_email}},
        {{params.employee_name}}, {{params.employee_role}}, {{params.employee_branch}},
        {{params.document_date}}::date, {{params.revaluation_date}}::date,
        {{params.warning_level}}, {{params.final_outcome}}, {{params.scenario}},
        {{params.q_expected}}, {{params.q_happened}}, {{params.q_when}}, {{params.q_impact}},
        ARRAY[{{params.evidence_types}}]::text[], {{params.evidence_description}},
        {{params.prior_warnings}}, {{params.expectations}}, {{params.consequences}},
        {{params.signature_drawn}},
        {{params.pdf_en_base64}}, {{params.pdf_es_base64}}
      )
      RETURNING id, ref, employee_name, submitted_at;
    `,
  });
}

export default saveSubmission;
