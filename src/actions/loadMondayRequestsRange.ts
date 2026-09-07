import { action } from '@uibakery/data';

export function loadMondayRequestsRange() {
  return action('loadMondayRequestsRange', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT r.employee_id,
             COALESCE(r.request_type, '')    AS request_type,
             COALESCE(r.permission_type, '') AS permission_type,
             r.start_date::text              AS start_date,
             r.end_date::text                AS end_date,
             r.return_date::text             AS return_date
      FROM public.monday_requests r
      LEFT JOIN public.employees e ON e.id = r.employee_id
      WHERE r.deleted_on_monday = false
        AND r.employee_id IS NOT NULL
        AND COALESCE(r.start_date, r.end_date) <= {{params.dateTo}}::date
        AND COALESCE(r.return_date, r.end_date, r.start_date) >= {{params.dateFrom}}::date
        AND (COALESCE({{params.manager}}, '') = '' OR e.manager = {{params.manager}})
      ORDER BY r.start_date
    `,
  });
}

export default loadMondayRequestsRange;
