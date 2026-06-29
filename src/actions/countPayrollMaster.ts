import { action } from '@uibakery/data';

function countPayrollMaster() {
  return action('countPayrollMaster', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT COUNT(*)::int AS total
      FROM payroll_entries pe
      JOIN employees e ON e.id = pe.employee_id
      WHERE
        pe.deleted_at IS NULL
        AND (COALESCE({{params.periodName}}, '') = '' OR pe.period_name = {{params.periodName}})
        AND (COALESCE({{params.employeeName}}, '') = '' OR e.display_name ILIKE {{ '%' + params.employeeName + '%' }})
        AND (COALESCE({{params.status}}, '') = '' OR pe.status_current = {{params.status}});
    `,
  });
}

export default countPayrollMaster;
