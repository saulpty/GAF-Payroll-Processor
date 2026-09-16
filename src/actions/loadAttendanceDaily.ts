import { action } from '@uibakery/data';

export function loadAttendanceDaily() {
  return action('loadAttendanceDaily', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT d.email, d.name, d.date, d.entry_time, ex.exit_time, d.status, d.bucket, d.filed_gaf,
             d.minutes_late, d.period_name, d.time_off_kind
      FROM public.v_attendance_daily d
      LEFT JOIN LATERAL (
        SELECT CASE
                 WHEN x.t IS NULL THEN NULL
                 WHEN UPPER(x.t) ~ '^[0-9]{1,2}:[0-9]{2} ?[AP]M$' THEN TO_CHAR(to_timestamp(UPPER(x.t), 'HH12:MI AM')::time, 'HH24:MI')
                 WHEN UPPER(x.t) ~ '^[0-9]{1,2}[AP]M$' THEN TO_CHAR(to_timestamp(UPPER(x.t), 'HH12AM')::time, 'HH24:MI')
                 ELSE x.t
               END AS exit_time
        FROM (
          SELECT NULLIF(TRIM(pe.exit_time), '') AS t
          FROM public.payroll_entries pe
          JOIN public.employees e ON e.id = pe.employee_id
          WHERE e.teramind_email = d.email
            AND LEFT(pe.work_date, 10)::date = d.date
            AND pe.deleted_at IS NULL
          ORDER BY pe.period_name DESC
          LIMIT 1
        ) x
      ) ex ON true
      WHERE d.date >= {{params.dateFrom}}
        AND d.date <= {{params.dateTo}}
        AND (COALESCE({{params.email}}, '') = '' OR d.email = {{params.email}})
        AND d.email IN (SELECT e.teramind_email FROM public.employees e
                        JOIN public.v_employee_access a ON a.employee_id = e.id
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY d.date, d.name
    `,
  });
}

export default loadAttendanceDaily;
