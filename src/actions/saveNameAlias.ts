import { action } from '@uibakery/data';

function saveNameAlias() {
  return action('saveNameAlias', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO name_aliases (alias_text, employee_id)
      VALUES ({{params.aliasText}}, {{params.employeeId}}::bigint)
      ON CONFLICT (alias_text) DO UPDATE SET employee_id = EXCLUDED.employee_id;
    `,
  });
}

export default saveNameAlias;
