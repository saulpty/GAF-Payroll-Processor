import { action } from '@uibakery/data';

function upsertDocumentationOption() {
  return action('upsertDocumentationOption', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `INSERT INTO documentation_options (name) SELECT {{params.name}} WHERE public.assert_super({{ user.email }}::text) ON CONFLICT (name) DO NOTHING;`,
  });
}

export default upsertDocumentationOption;
