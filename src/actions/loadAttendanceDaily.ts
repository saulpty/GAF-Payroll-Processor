import { action } from '@uibakery/data';

export function loadAttendanceDaily() {
  return action('loadAttendanceDaily', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT email, name, date, entry_time, status, bucket, filed_gaf, minutes_late, period_name
      FROM public.v_attendance_daily
      WHERE date >= {{params.dateFrom}}
        AND date <= {{params.dateTo}}
        AND (COALESCE({{params.email}}, '') = '' OR email = {{params.email}})
      ORDER BY date, name
    `,
  });
}

export default loadAttendanceDaily;
