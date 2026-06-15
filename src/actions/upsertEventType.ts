import { action } from '@uibakery/data';

function upsertEventType() {
  return action('upsertEventType', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `INSERT INTO event_types (name) VALUES ({{params.name}}) ON CONFLICT (name) DO NOTHING;`,
  });
}

export default upsertEventType;
