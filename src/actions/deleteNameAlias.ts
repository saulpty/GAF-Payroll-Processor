import { action } from '@uibakery/data';

function deleteNameAlias() {
  return action('deleteNameAlias', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `DELETE FROM name_aliases WHERE id = {{params.id}}::bigint AND public.assert_super({{ user.email }}::text);`,
  });
}

export default deleteNameAlias;
