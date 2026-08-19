import { action } from '@uibakery/data';

// Loads monday_requests of type "PTO / Vacation" that have no pto_approvals record yet.
function loadPendingPtoRequests() {
  return action('loadPendingPtoRequests', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        r.monday_item_id,
        r.employee_id,
        e.display_name,
        r.employee_name_raw,
        r.start_date::text      AS leave_on,
        r.return_date::text     AS return_on,
        r.total_days_requested  AS total_days,
        r.reason,
        r.submitted_at,
        r.board_group
      FROM monday_requests r
      LEFT JOIN employees e ON e.id = r.employee_id
      LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
      WHERE r.request_type = 'PTO / Vacation'
        AND r.deleted_on_monday = false
        AND a.id IS NULL
        AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
      ORDER BY r.start_date DESC
    `,
  });
}

export default loadPendingPtoRequests;
