import { action } from '@uibakery/data';

function upsertPayImpact() {
  return action('upsertPayImpact', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `INSERT INTO pay_impacts (name) SELECT {{params.name}} WHERE public.assert_super({{ user.email }}::text) ON CONFLICT (name) DO NOTHING;`,
  });
}

export default upsertPayImpact;
