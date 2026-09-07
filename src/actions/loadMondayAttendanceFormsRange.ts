import { action } from '@uibakery/data';

export function loadMondayAttendanceFormsRange() {
  return action('loadMondayAttendanceFormsRange', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT f.employee_id,
             f.form_date::text                    AS form_date,
             COALESCE(f.form_type, '')             AS form_type,
             COALESCE(f.reason, '')                AS reason,
             COALESCE(f.details, '')               AS details,
             COALESCE(f.eta, '')                   AS eta,
             f.submitted_at,
             COALESCE(f.employee_email_raw, '')    AS employee_email_raw,
             f.monday_item_id::text                AS monday_item_id
      FROM public.monday_attendance_forms f
      LEFT JOIN public.employees e ON e.id = f.employee_id
      WHERE f.deleted_on_monday = false
        AND f.form_date >= {{params.dateFrom}}::date
        AND f.form_date <= {{params.dateTo}}::date
        AND (COALESCE({{params.manager}}, '') = '' OR e.manager = {{params.manager}})
      ORDER BY f.form_date, f.monday_item_id
    `,
  });
}

export default loadMondayAttendanceFormsRange;
