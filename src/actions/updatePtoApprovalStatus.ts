import { action } from '@uibakery/data';

// Updates just the status (and optionally recorded_by) of an existing approval.
function updatePtoApprovalStatus() {
  return action('updatePtoApprovalStatus', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE pto_approvals
      SET
        status     = {{params.status}},
        updated_at = NOW()
      WHERE id = {{params.id}}::bigint
    `,
  });
}

export default updatePtoApprovalStatus;
