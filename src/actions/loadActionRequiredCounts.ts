import { action } from '@uibakery/data';

function loadActionRequiredCounts() {
  return action('loadActionRequiredCounts', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT
        SUM(CASE WHEN initial_status = 'RED'    THEN 1 ELSE 0 END)::int AS red_count,
        SUM(CASE WHEN initial_status = 'YELLOW' THEN 1 ELSE 0 END)::int AS yellow_count
      FROM payroll_entries
      WHERE initial_status IN ('RED','YELLOW')
        AND payroll_ready = 'NO'
        AND deleted_at IS NULL
        AND (COALESCE({{params.periodName}}, '') = '' OR period_name = {{params.periodName}});
    `,
  });
}

export default loadActionRequiredCounts;
