import { action } from '@uibakery/data';

// PTO + Floating Holiday that is happening now or starts on/before {{params.until}}.
// Pending = on Monday with no pto_approvals row (same test as loadPtoEmployeeDetail);
// recorded = pto_approvals.status 'recorded' (withdrawn left out). Scoped to the viewer.
function loadPtoUpcoming() {
  return action('loadPtoUpcoming', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT u.* FROM (
        SELECT e.id AS employee_id, e.display_name,
               CASE WHEN r.request_type = 'Floating Holiday' THEN 'floating_holiday' ELSE 'pto' END AS leave_type,
               r.start_date::text AS leave_on, r.return_date::text AS return_on,
               NULLIF(r.total_days_requested, 'NaN'::numeric)::numeric AS total_days,
               'pending' AS status
        FROM monday_requests r
        JOIN employees e ON e.id = r.employee_id
        LEFT JOIN pto_approvals a ON a.monday_item_id = r.monday_item_id
        WHERE r.request_type IN ('PTO / Vacation','Floating Holiday')
          AND r.deleted_on_monday = false AND a.id IS NULL
          AND r.return_date > {{params.today}}::date
          AND r.start_date <= {{params.until}}::date
          AND r.return_date >= r.start_date
          AND e.active = true
          AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.id IN (SELECT vm.employee_id FROM public.v_employee_managers vm WHERE vm.manager_name = {{params.manager}}::text))
          AND e.id IN (SELECT va.employee_id FROM public.v_employee_access va
                        WHERE va.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
        UNION ALL
        SELECT e.id AS employee_id, e.display_name,
               a.leave_type::text AS leave_type,
               a.leave_on::text AS leave_on, a.return_on::text AS return_on,
               a.total_days::numeric AS total_days,
               'recorded' AS status
        FROM pto_approvals a
        JOIN employees e ON e.id = a.employee_id
        WHERE a.status = 'recorded'
          AND a.return_on > {{params.today}}::date
          AND a.leave_on <= {{params.until}}::date
          AND a.return_on >= a.leave_on
          AND e.active = true
          AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.id IN (SELECT vm.employee_id FROM public.v_employee_managers vm WHERE vm.manager_name = {{params.manager}}::text))
          AND e.id IN (SELECT va.employee_id FROM public.v_employee_access va
                        WHERE va.email = access_viewer({{ user.email }}::text, {{params.viewAs}}::text))
      ) u
      ORDER BY u.leave_on, u.display_name
    `,
  });
}

export default loadPtoUpcoming;
