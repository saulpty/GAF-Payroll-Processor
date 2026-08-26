import { action } from '@uibakery/data';

function loadSummaryDashboard() {
  return action('loadSummaryDashboard', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        e.display_name AS employee_name,
        COUNT(*) AS days_in_period,
        COUNT(CASE WHEN pe.entry_time IS NOT NULL THEN 1 END) AS days_worked,
        COUNT(CASE WHEN pe.event_type_1 LIKE 'Ausencia%' THEN 1 END) AS absences,
        COUNT(CASE WHEN pe.event_type_1 = 'Tardanza' THEN 1 END) AS late_days,
        COUNT(CASE WHEN pe.event_type_1 = 'Salida Temprano' OR pe.event_type_2 = 'Salida Temprano' THEN 1 END) AS early_leave_days,
        SUM(pe.discount_total_minutes) AS total_discount_minutes,
        ROUND(SUM(pe.discount_total_minutes)::numeric / 60, 2) AS total_discount_hours,
        COUNT(CASE WHEN pe.event_type_1 = 'PTO' OR pe.event_type_1 = 'Permiso Remunerado' THEN 1 END) AS pto_days,
        COUNT(CASE WHEN pe.event_type_1 = 'Feriado' THEN 1 END) AS holiday_days,
        COUNT(CASE WHEN pe.initial_status = 'RED' THEN 1 END) AS red_count,
        COUNT(CASE WHEN pe.initial_status = 'YELLOW' THEN 1 END) AS yellow_count,
        BOOL_AND(pe.payroll_ready = 'YES') AS all_ready,
        SUM(CASE WHEN pe.event_type_1 = 'Tardanza' THEN pe.discount_total_minutes ELSE 0 END) AS tardanza_minutes,
        SUM(CASE WHEN pe.event_type_1 = 'Salida Temprano' OR pe.event_type_2 = 'Salida Temprano' THEN pe.early_leave_minutes ELSE 0 END) AS salida_minutes,
        SUM(CASE WHEN pe.event_type_1 = 'Permiso No remunerado' OR pe.pay_impact_1 = 'Unpaid' THEN pe.discount_total_minutes ELSE 0 END) AS permiso_no_rem_minutes,
        SUM(CASE WHEN pe.pay_impact_1 = 'Constancia Medica' THEN pe.discount_total_minutes ELSE 0 END) AS constancia_minutes,
        SUM(CASE WHEN pe.event_type_1 = 'Ausencia Injustificada' THEN pe.discount_total_minutes ELSE 0 END) AS ausencia_injustificada_minutes
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE pe.period_name = {{params.periodName}}
        AND pe.deleted_at IS NULL
      GROUP BY e.display_name
      ORDER BY e.display_name;
    `,
  });
}

export default loadSummaryDashboard;
