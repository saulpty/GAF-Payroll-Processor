import { action } from '@uibakery/data';

function loadPtoBalancesInputs() {
  return action('loadPtoBalancesInputs', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT e.id AS employee_id, e.display_name, e.role, e.manager, e.start_date::text AS start_date,
             pe.pto_start_date_override::text AS pto_start_date_override,
             COALESCE(pe.paid_pto_days, 0) AS paid_pto_days,
             COALESCE((SELECT SUM(total_days) FROM pto_approvals a WHERE a.employee_id = e.id AND a.status = 'recorded' AND a.leave_type = 'pto'), 0) AS taken_days,
             (SELECT count(*) FROM monday_requests r LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id AND a.status <> 'withdrawn'
               WHERE r.employee_id = e.id AND r.request_type IN ('PTO / Vacation','Floating Holiday') AND r.deleted_on_monday = false AND a.id IS NULL) AS pending_count,
             COALESCE(fh.fh_allocated, 2) AS fh_allocated,
             (SELECT count(*) FROM pto_approvals a
               WHERE a.employee_id = e.id AND a.leave_type = 'floating_holiday' AND a.status = 'recorded'
                 AND EXTRACT(YEAR FROM a.leave_on)::text = {{params.year}}::text) AS fh_used,
             (SELECT COALESCE(SUM(GREATEST(1, COALESCE(NULLIF(r.total_days_requested, 'NaN'::numeric), 1))),0) FROM monday_requests r WHERE r.employee_id = e.id AND r.request_type = 'Work From Home' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM r.start_date)::text = {{params.year}}::text) AS wfh_days,
             (SELECT count(*) FROM monday_requests r WHERE r.employee_id = e.id AND r.request_type = 'Birthday Day Off' AND r.deleted_on_monday = false AND EXTRACT(YEAR FROM r.start_date)::text = {{params.year}}::text) AS birthday_days
      FROM employees e
      LEFT JOIN pto_employees pe ON pe.employee_id = e.id
      LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year::text = {{params.year}}::text
      WHERE e.active = true
        AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
      ORDER BY e.display_name
    `,
  });
}

export default loadPtoBalancesInputs;
