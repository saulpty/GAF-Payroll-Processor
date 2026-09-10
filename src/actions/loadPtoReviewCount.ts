import { action } from '@uibakery/data';

function loadPtoReviewCount() {
  return action('loadPtoReviewCount', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT COUNT(*)::int AS count
      FROM monday_requests r
      JOIN employees e ON e.id = r.employee_id AND e.active = true
      LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
      WHERE r.request_type IN ('PTO / Vacation','Floating Holiday')
        AND r.deleted_on_monday = false AND a.id IS NULL
        AND r.return_date >= r.start_date
        AND r.return_date <= {{params.today}}::date
        AND r.return_date <= (SELECT MAX(p.end_date) FROM periods p WHERE p.processed_at IS NOT NULL)
        AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
    `,
  });
}

export default loadPtoReviewCount;
