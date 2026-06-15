import { action } from '@uibakery/data';

function loadNameAliasesAdmin() {
  return action('loadNameAliasesAdmin', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT na.id, na.alias_text, na.employee_id, e.display_name AS employee_name
      FROM name_aliases na
      JOIN employees e ON e.id = na.employee_id
      ORDER BY na.alias_text;
    `,
  });
}

export default loadNameAliasesAdmin;
