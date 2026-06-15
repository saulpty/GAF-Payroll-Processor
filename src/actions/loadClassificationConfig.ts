import { action } from '@uibakery/data';

function loadClassificationConfig() {
  return action('loadClassificationConfig', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT id, key, value, label, description, value_type, category, updated_at
      FROM classification_config
      ORDER BY category, label;
    `,
  });
}

export default loadClassificationConfig;
