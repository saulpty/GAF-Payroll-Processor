import { action } from '@uibakery/data';

function loadUnresolvedCount() {
  return action('loadUnresolvedCount', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT COUNT(*)::int AS count
      FROM payroll_entries
      WHERE initial_status IN ('RED','YELLOW') AND payroll_ready = 'NO';
    `,
  });
}

export default loadUnresolvedCount;
