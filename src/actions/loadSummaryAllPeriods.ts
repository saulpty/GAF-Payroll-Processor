import { action } from '@uibakery/data';

function loadSummaryAllPeriods() {
  return action('loadSummaryAllPeriods', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        pe.period_name,
        p.start_date::text AS start_date,
        COUNT(*) AS total_entries,
        COUNT(CASE WHEN pe.initial_status = 'GREEN'  THEN 1 END) AS green_count,
        COUNT(CASE WHEN pe.initial_status = 'YELLOW' THEN 1 END) AS yellow_count,
        COUNT(CASE WHEN pe.initial_status = 'RED'    THEN 1 END) AS red_count,
        COUNT(CASE WHEN pe.event_type_1 = 'Tardanza' THEN 1 END) AS tardanza_count,
        COUNT(CASE WHEN pe.event_type_1 LIKE 'Ausencia%' THEN 1 END) AS absence_count,
        COUNT(CASE WHEN pe.event_type_1 = 'Ausencia Injustificada' THEN 1 END) AS unjustified_count,
        COUNT(CASE WHEN pe.event_type_1 = 'Ausencia Justificada.' THEN 1 END) AS justified_count,
        COUNT(CASE WHEN pe.event_type_1 IN ('PTO','Permiso Remunerado') THEN 1 END) AS pto_count,
        COUNT(CASE WHEN pe.event_type_1 = 'Feriado' THEN 1 END) AS holiday_count,
        COUNT(CASE WHEN pe.event_type_1 = 'Salida Temprano' OR pe.event_type_2 = 'Salida Temprano' THEN 1 END) AS early_leave_count,
        COALESCE(SUM(pe.discount_total_minutes), 0) AS total_discount_minutes,
        COUNT(DISTINCT pe.employee_id) AS employee_count,
        COUNT(CASE WHEN pe.payroll_ready = 'YES' THEN 1 END) AS ready_count
      FROM payroll_entries pe
      LEFT JOIN periods p ON p.period_name = pe.period_name
      GROUP BY pe.period_name, p.start_date
      ORDER BY p.start_date ASC;
    `,
  });
}

export default loadSummaryAllPeriods;
