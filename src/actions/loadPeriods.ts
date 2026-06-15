import { action } from '@uibakery/data';

function loadPeriods() {
  return action('loadPeriods', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT period_name, start_date::text AS start_date, end_date::text AS end_date,
             processed_at, employee_count, day_count, green_count, yellow_count, red_count, notes
      FROM periods
      ORDER BY start_date DESC;
    `,
  });
}

export default loadPeriods;
