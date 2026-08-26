import { action } from '@uibakery/data';

function loadPtoEmployeeDetail() {
  return action('loadPtoEmployeeDetail', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        COALESCE((
          SELECT json_agg(json_build_object(
            'monday_item_id', r.monday_item_id, 'employee_id', r.employee_id, 'display_name', e.display_name,
            'employee_name_raw', r.employee_name_raw, 'leave_on', r.start_date::text, 'return_on', r.return_date::text,
            'total_days', r.total_days_requested, 'reason', r.reason, 'submitted_at', r.submitted_at::text,
            'leave_type', CASE WHEN r.request_type = 'Floating Holiday' THEN 'floating_holiday' ELSE 'pto' END,
            'payroll', (
              SELECT string_agg(x.t || ' x' || x.c, ', ' ORDER BY x.c DESC, x.t)
              FROM (
                SELECT COALESCE(NULLIF(TRIM(pe.event_type_1),''), 'no event') AS t, count(*) AS c
                FROM payroll_entries pe
                WHERE pe.employee_id = r.employee_id
                  AND LEFT(pe.work_date,10)::date >= r.start_date
                  AND LEFT(pe.work_date,10)::date <  GREATEST(r.return_date, r.start_date + 1)
                  AND pe.deleted_at IS NULL
                GROUP BY 1
              ) x
            )
          ) ORDER BY r.start_date DESC)
          FROM monday_requests r
          LEFT JOIN employees e ON e.id = r.employee_id
          LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id AND a.status <> 'withdrawn'
          WHERE r.employee_id = {{params.employee_id}}::bigint
            AND r.request_type IN ('PTO / Vacation','Floating Holiday') AND r.deleted_on_monday = false AND a.id IS NULL
        ), '[]'::json) AS pending,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', a.id, 'employee_id', a.employee_id, 'display_name', e.display_name,
            'leave_on', a.leave_on::text, 'return_on', a.return_on::text, 'total_days', a.total_days,
            'status', a.status, 'source', a.source, 'gaf_comments', a.gaf_comments, 'recorded_by', a.recorded_by,
            'monday_item_id', a.monday_item_id, 'recorded_at', a.recorded_at::text,
            'leave_type', a.leave_type,
            'payroll', (
              SELECT string_agg(x.t || ' x' || x.c, ', ' ORDER BY x.c DESC, x.t)
              FROM (
                SELECT COALESCE(NULLIF(TRIM(pe.event_type_1),''), 'no event') AS t, count(*) AS c
                FROM payroll_entries pe
                WHERE pe.employee_id = a.employee_id
                  AND LEFT(pe.work_date,10)::date >= a.leave_on
                  AND LEFT(pe.work_date,10)::date <  GREATEST(a.return_on, a.leave_on + 1)
                  AND pe.deleted_at IS NULL
                GROUP BY 1
              ) x
            )
          ) ORDER BY a.leave_on DESC, a.id DESC)
          FROM pto_approvals a LEFT JOIN employees e ON e.id = a.employee_id
          WHERE a.employee_id = {{params.employee_id}}::bigint
        ), '[]'::json) AS ledger,
        (
          SELECT json_build_object(
            'fh_allocated', COALESCE(fh.fh_allocated, 2), 'fh_used', COALESCE(fh.fh_used, 0), 'notes', fh.notes,
            'start_date', e.start_date::text, 'pto_start_date_override', pe.pto_start_date_override::text
          )
          FROM employees e
          LEFT JOIN pto_employees pe ON pe.employee_id = e.id
          LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year::text = {{params.year}}::text
          WHERE e.id = {{params.employee_id}}::bigint
            AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
        ) AS fh
    `,
  });
}

export default loadPtoEmployeeDetail;
