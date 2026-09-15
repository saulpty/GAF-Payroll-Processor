import { action } from '@uibakery/data';

export function loadAttendanceDaily() {
  return action('loadAttendanceDaily', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT email, name, date, entry_time, status, bucket, filed_gaf, minutes_late, period_name, time_off_kind
      FROM public.v_attendance_daily
      WHERE date >= {{params.dateFrom}}
        AND date <= {{params.dateTo}}
        AND (COALESCE({{params.email}}, '') = '' OR email = {{params.email}})
        AND email IN (SELECT e.teramind_email FROM public.employees e
                        JOIN public.v_employee_access a ON a.employee_id = e.id
                       WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY date, name
    `,
  });
}

export default loadAttendanceDaily;
