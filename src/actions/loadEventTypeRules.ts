import { action } from '@uibakery/data';

function loadEventTypeRules() {
  return action('loadEventTypeRules', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT id, event_type, default_pay_impact, default_doc_option, notes
      FROM event_type_rules
      ORDER BY event_type;
    `,
  });
}

export default loadEventTypeRules;
