import { action } from '@uibakery/data';

function deleteAccessGroupMember() {
  return action('deleteAccessGroupMember', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      DELETE FROM access_group_members
       WHERE group_id = {{params.group_id}}::bigint AND employee_id = {{params.employee_id}}::bigint;
    `,
  });
}

export default deleteAccessGroupMember;
