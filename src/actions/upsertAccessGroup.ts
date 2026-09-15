import { action } from '@uibakery/data';

function upsertAccessGroup() {
  return action('upsertAccessGroup', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      WITH upd AS (
        UPDATE access_groups SET name = btrim({{params.name}}::text), notes = {{params.notes}}::text
         WHERE id = {{params.id}}::bigint
        RETURNING id
      )
      INSERT INTO access_groups (name, notes)
      SELECT btrim({{params.name}}::text), {{params.notes}}::text
       WHERE NOT EXISTS (SELECT 1 FROM upd)
      ON CONFLICT (name) DO NOTHING;
    `,
  });
}

export default upsertAccessGroup;
