import { action } from '@uibakery/data';

function upsertDocumentationOption() {
  return action('upsertDocumentationOption', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `INSERT INTO documentation_options (name) VALUES ({{params.name}}) ON CONFLICT (name) DO NOTHING;`,
  });
}

export default upsertDocumentationOption;
