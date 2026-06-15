import { action } from '@uibakery/data';

function upsertEmployee() {
  return action('upsertEmployee', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO employees (display_name, teramind_email, company_domain, schedule_id,
        is_grace_list, is_macbook_swap, excluded_from_payroll, active, notes)
      VALUES (
        {{params.display_name}}, {{params.teramind_email}}, {{params.company_domain}},
        {{params.schedule_id}}::bigint,
        {{params.is_grace_list}}::boolean, {{params.is_macbook_swap}}::boolean,
        {{params.excluded_from_payroll}}::boolean, {{params.active}}::boolean,
        {{params.notes}}
      )
      ON CONFLICT (teramind_email) DO UPDATE SET
        display_name            = EXCLUDED.display_name,
        company_domain          = EXCLUDED.company_domain,
        schedule_id             = EXCLUDED.schedule_id,
        is_grace_list           = EXCLUDED.is_grace_list,
        is_macbook_swap         = EXCLUDED.is_macbook_swap,
        excluded_from_payroll   = EXCLUDED.excluded_from_payroll,
        active                  = EXCLUDED.active,
        notes                   = EXCLUDED.notes;
    `,
  });
}

export default upsertEmployee;
