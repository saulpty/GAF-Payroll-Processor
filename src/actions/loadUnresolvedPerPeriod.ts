import { action } from '@uibakery/data';

function loadUnresolvedPerPeriod() {
  return action('loadUnresolvedPerPeriod', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT period_name, COUNT(*)::int AS unresolved_count
      FROM payroll_entries
      WHERE initial_status IN ('RED','YELLOW') AND payroll_ready = 'NO'
      GROUP BY period_name;
    `,
  });
}

export default loadUnresolvedPerPeriod;
