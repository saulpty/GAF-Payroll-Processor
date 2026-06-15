import { action } from '@uibakery/data';

function upsertClassificationConfig() {
  return action('upsertClassificationConfig', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO classification_config (key, value, label, description, value_type, category)
      VALUES ({{params.key}}, {{params.value}}, {{params.label}}, {{params.description}}, {{params.value_type}}, {{params.category}})
      ON CONFLICT (key) DO UPDATE SET
        value      = EXCLUDED.value,
        label      = EXCLUDED.label,
        description = EXCLUDED.description,
        updated_at = NOW();
    `,
  });
}

export default upsertClassificationConfig;
