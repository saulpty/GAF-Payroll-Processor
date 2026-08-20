import { action } from '@uibakery/data';

// Insert a new pto_approval or update existing record matched by monday_item_id.
function upsertPtoApproval() {
  return action('upsertPtoApproval', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO pto_approvals
        (employee_id, leave_on, return_on, total_days, status, source,
         gaf_comments, submitted_by, recorded_by, recorded_at, monday_item_id, leave_type)
      VALUES (
        {{params.employee_id}}::bigint,
        {{params.leave_on}}::date,
        {{params.return_on}}::date,
        {{params.total_days}}::numeric,
        {{params.status}},
        {{params.source}},
        {{params.gaf_comments}},
        {{params.submitted_by}},
        {{params.recorded_by}},
        NOW(),
        {{params.monday_item_id}}::bigint,
        {{params.leave_type}}
      )
      ON CONFLICT (monday_item_id) WHERE monday_item_id IS NOT NULL
      DO UPDATE SET
        employee_id  = EXCLUDED.employee_id,
        leave_on     = EXCLUDED.leave_on,
        return_on    = EXCLUDED.return_on,
        total_days   = EXCLUDED.total_days,
        status       = EXCLUDED.status,
        gaf_comments = EXCLUDED.gaf_comments,
        submitted_by = EXCLUDED.submitted_by,
        recorded_by  = EXCLUDED.recorded_by,
        recorded_at  = EXCLUDED.recorded_at,
        leave_type   = EXCLUDED.leave_type,
        updated_at   = NOW()
      RETURNING id
    `,
  });
}

export default upsertPtoApproval;
