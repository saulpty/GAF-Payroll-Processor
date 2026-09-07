import { action } from '@uibakery/data';

export function loadAttendanceReportDays() {
  return action('loadAttendanceReportDays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT DISTINCT ON (pe.employee_id, LEFT(pe.work_date, 10))
             pe.employee_id,
             TO_CHAR(LEFT(pe.work_date, 10)::date, 'YYYY-MM-DD') AS work_date,
             NULLIF(TRIM(pe.entry_time), '')                      AS entry_time,
             NULLIF(TRIM(pe.exit_time), '')                       AS exit_time,
             NULLIF(TRIM(pe.scheduled_start), '')                 AS scheduled_start,
             GREATEST(0, COALESCE(pe.late_minutes, 0))           AS late_minutes,
             GREATEST(0, COALESCE(pe.early_leave_minutes, 0))    AS early_leave_minutes,
             COALESCE(pe.event_type_1, '')                        AS event_type_1,
             COALESCE(pe.documentation, '')                       AS documentation,
             COALESCE(pe.auto_notes, '')                          AS auto_notes,
             pe.period_name
      FROM public.payroll_entries pe
      JOIN public.employees e ON e.id = pe.employee_id
      WHERE pe.deleted_at IS NULL
        AND LEFT(pe.work_date, 10) >= {{params.dateFrom}}
        AND LEFT(pe.work_date, 10) <= {{params.dateTo}}
        AND e.active = true
        AND COALESCE(e.excluded_from_payroll, false) = false
        AND (COALESCE({{params.manager}}, '') = '' OR e.manager = {{params.manager}})
      ORDER BY pe.employee_id, LEFT(pe.work_date, 10), pe.period_name DESC
    `,
  });
}

export default loadAttendanceReportDays;
