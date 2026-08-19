import { action } from '@uibakery/data';

function loadFloatingHolidays() {
  return action('loadFloatingHolidays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT e.id AS employee_id, e.display_name, e.role, e.start_date::text AS start_date,
             pe.pto_start_date_override::text AS pto_start_date_override,
             COALESCE(fh.fh_allocated, 2) AS fh_allocated,
             COALESCE(fh.fh_used, 0) AS fh_used,
             fh.notes,
             (SELECT count(*) FROM monday_requests r
              WHERE r.employee_id = e.id
                AND r.request_type = 'Floating Holiday'
                AND r.deleted_on_monday = false
                AND EXTRACT(YEAR FROM r.start_date) = {{params.year}}) AS fh_requests
      FROM employees e
      LEFT JOIN pto_employees pe ON pe.employee_id = e.id
      LEFT JOIN pto_floating_holidays fh ON fh.employee_id = e.id AND fh.calendar_year = {{params.year}}
      WHERE e.active = true
        AND (COALESCE({{params.manager}}, '') = '' OR e.manager = {{params.manager}})
      ORDER BY e.display_name
    `,
  });
}

export default loadFloatingHolidays;
