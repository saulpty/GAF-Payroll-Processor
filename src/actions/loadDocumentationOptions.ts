import { action } from '@uibakery/data';

function loadDocumentationOptions() {
  return action('loadDocumentationOptions', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `SELECT id, name FROM documentation_options ORDER BY id;`,
  });
}

export default loadDocumentationOptions;
