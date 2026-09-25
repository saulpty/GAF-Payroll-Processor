import { action } from '@uibakery/data';

function updateEmployee() {
  return action('updateEmployee', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE employees SET
        display_name          = {{params.display_name}},
        teramind_email        = lower(btrim({{params.teramind_email}})),
        company_domain        = {{params.company_domain}},
        schedule_id           = {{params.schedule_id}}::bigint,
        is_grace_list         = {{params.is_grace_list}}::boolean,
        is_macbook_swap       = {{params.is_macbook_swap}}::boolean,
        excluded_from_payroll = {{params.excluded_from_payroll}}::boolean,
        active                = {{params.active}}::boolean,
        notes                 = {{params.notes}}
      WHERE id = {{params.id}}::bigint
        AND public.assert_super({{ user.email }}::text);
    `,
  });
}

export default updateEmployee;
