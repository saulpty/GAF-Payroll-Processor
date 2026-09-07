import { action } from '@uibakery/data';

export function loadAttendanceEmployees() {
  return action('loadAttendanceEmployees', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        e.id,
        e.display_name    AS name,
        e.teramind_email  AS email,
        COALESCE(e.role, '')    AS role,
        COALESCE(e.manager, '') AS manager,
        s.schedule_name,
        s.standard_start,
        s.standard_end,
        COALESCE(e.start_date::text, '')                              AS start_date,
        COALESCE(NULLIF(TRIM(s.work_days), ''), 'Mon,Tue,Wed,Thu,Fri') AS work_days,
        s.dst_start,
        s.dst_end,
        COALESCE(s.grace_minutes, 10)                                 AS grace_minutes
      FROM public.employees e
      LEFT JOIN public.schedules s ON s.id = e.schedule_id
      WHERE e.active = true
        AND COALESCE(e.excluded_from_payroll, false) = false
      ORDER BY e.display_name
    `,
  });
}

export default loadAttendanceEmployees;
