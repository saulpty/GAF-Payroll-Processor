import { action } from '@uibakery/data';

export function loadMondayRequestsRange() {
  return action('loadMondayRequestsRange', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT r.employee_id,
             COALESCE(r.request_type, '')              AS request_type,
             COALESCE(r.permission_type, '')            AS permission_type,
             TO_CHAR(r.start_date,  'YYYY-MM-DD')      AS start_date,
             TO_CHAR(r.end_date,    'YYYY-MM-DD')       AS end_date,
             TO_CHAR(r.return_date, 'YYYY-MM-DD')       AS return_date
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
