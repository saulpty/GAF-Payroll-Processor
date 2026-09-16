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
        COALESCE((SELECT vm.manager_name FROM public.v_employee_managers vm WHERE vm.employee_id = e.id AND vm.rank = 1 LIMIT 1), '') AS manager,
        COALESCE((SELECT string_agg(vm2.manager_name, '|' ORDER BY vm2.rank) FROM public.v_employee_managers vm2 WHERE vm2.employee_id = e.id), '') AS managers,
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
        AND e.id IN (SELECT a.employee_id FROM public.v_employee_access a
                      WHERE a.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ORDER BY e.display_name
    `,
  });
}

export default loadAttendanceEmployees;
