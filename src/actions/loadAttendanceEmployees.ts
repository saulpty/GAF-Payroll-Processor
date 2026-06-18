import { action } from '@uibakery/data';

export function loadAttendanceEmployees() {
  return action('loadAttendanceEmployees', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        e.id,
        e.display_name AS name,
        e.teramind_email AS email,
        COALESCE(e.role, '')    AS role,
        COALESCE(e.manager, '') AS manager,
        s.schedule_name,
        s.standard_start,
        s.standard_end
      FROM public.employees e
      LEFT JOIN public.schedules s ON s.id = e.schedule_id
      WHERE e.active = true
        AND COALESCE(e.excluded_from_payroll, false) = false
      ORDER BY e.display_name
    `,
  });
}

export default loadAttendanceEmployees;
