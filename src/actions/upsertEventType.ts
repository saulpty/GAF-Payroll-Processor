import { action } from '@uibakery/data';

function upsertEventType() {
  return action('upsertEventType', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `INSERT INTO event_types (name) SELECT {{params.name}} WHERE public.assert_super({{ user.email }}::text) ON CONFLICT (name) DO NOTHING;`,
  });
}

export default upsertEventType;
