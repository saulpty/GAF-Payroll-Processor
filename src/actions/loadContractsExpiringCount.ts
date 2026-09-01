import { action } from '@uibakery/data';

function loadContractsExpiringCount() {
  return action('loadContractsExpiringCount', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT COUNT(*)::int AS count
      FROM employees e
      JOIN LATERAL (
        SELECT mc.*
        FROM monday_contracts mc
        WHERE mc.employee_id = e.id
          AND mc.deleted_on_monday = false
        ORDER BY mc.start_date DESC NULLS LAST
        LIMIT 1
      ) c ON true
      WHERE e.active = true
        AND c.contract_end_date >= CURRENT_DATE
        AND c.contract_end_date < CURRENT_DATE + 30;
    `,
  });
}

export default loadContractsExpiringCount;
