import { action } from '@uibakery/data';

// Updates a pto_approval row in-place by its own id.
// Use this for corrections to manual/Excel-imported rows (which have no monday_item_id).
function updatePtoApproval() {
  return action('updatePtoApproval', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE pto_approvals
      SET employee_id  = {{params.employee_id}}::bigint,
          leave_on     = {{params.leave_on}}::date,
          return_on    = {{params.return_on}}::date,
          total_days   = {{params.total_days}}::numeric,
          gaf_comments = {{params.gaf_comments}},
          recorded_by  = {{params.recorded_by}},
          updated_at   = NOW()
      WHERE id = {{params.id}}::bigint
    `,
  });
}

export default updatePtoApproval;
