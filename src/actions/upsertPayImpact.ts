import { action } from '@uibakery/data';

function upsertPayImpact() {
  return action('upsertPayImpact', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `INSERT INTO pay_impacts (name) VALUES ({{params.name}}) ON CONFLICT (name) DO NOTHING;`,
  });
}

export default upsertPayImpact;
