import { action } from '@uibakery/data';

function upsertAccessGroupMember() {
  return action('upsertAccessGroupMember', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO access_group_members (group_id, employee_id)
      VALUES ({{params.group_id}}::bigint, {{params.employee_id}}::bigint)
      ON CONFLICT (group_id, employee_id) DO NOTHING;
    `,
  });
}

export default upsertAccessGroupMember;
