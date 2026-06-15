import { action } from '@uibakery/data';

function upsertPeriod() {
  return action('upsertPeriod', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO periods (period_name, start_date, end_date, processed_at, employee_count, day_count, green_count, yellow_count, red_count)
      VALUES (
        {{params.period_name}}, {{params.start_date}}, {{params.end_date}},
        NOW()::text, {{params.employee_count}}::int, {{params.day_count}}::int,
        {{params.green_count}}::int, {{params.yellow_count}}::int, {{params.red_count}}::int
      )
      ON CONFLICT (period_name) DO UPDATE SET
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        processed_at = EXCLUDED.processed_at,
        employee_count = EXCLUDED.employee_count,
        day_count = EXCLUDED.day_count,
        green_count = EXCLUDED.green_count,
        yellow_count = EXCLUDED.yellow_count,
        red_count = EXCLUDED.red_count;
    `,
  });
}

export default upsertPeriod;
