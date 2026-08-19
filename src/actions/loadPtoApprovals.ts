import { action } from '@uibakery/data';

// Loads all pto_approvals joined with employee display_name.
function loadPtoApprovals() {
  return action('loadPtoApprovals', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        a.id,
        a.employee_id,
        e.display_name,
        a.leave_on::text    AS leave_on,
        a.return_on::text   AS return_on,
        a.total_days,
        a.status,
        a.source,
        a.gaf_comments,
        a.submitted_by,
        a.recorded_by,
        a.recorded_at::text AS recorded_at,
        a.monday_item_id,
        a.created_at::text  AS created_at
      FROM pto_approvals a
      LEFT JOIN employees e ON e.id = a.employee_id
      WHERE ({{params.year}}::int IS NULL OR EXTRACT(YEAR FROM a.leave_on) = {{params.year}}::int)
        AND ({{params.employeeId}}::bigint IS NULL OR a.employee_id = {{params.employeeId}}::bigint)
        AND ({{params.status}} IS NULL OR {{params.status}} = '' OR a.status = {{params.status}})
        AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
      ORDER BY a.leave_on DESC
    `,
  });
}

export default loadPtoApprovals;
