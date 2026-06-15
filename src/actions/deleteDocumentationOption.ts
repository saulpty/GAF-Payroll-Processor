import { action } from '@uibakery/data';

function deleteDocumentationOption() {
  return action('deleteDocumentationOption', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM documentation_options WHERE id = {{params.id}}::bigint;`,
  });
}

export default deleteDocumentationOption;
