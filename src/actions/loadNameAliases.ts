import { action } from '@uibakery/data';

function loadNameAliases() {
  return action('loadNameAliases', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT na.id, na.alias_text, e.display_name, e.id AS employee_id
      FROM name_aliases na
      JOIN employees e ON e.id = na.employee_id
      ORDER BY na.alias_text;
    `,
  });
}

export default loadNameAliases;
