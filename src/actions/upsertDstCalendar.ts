import { action } from '@uibakery/data';

function upsertDstCalendar() {
  return action('upsertDstCalendar', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO dst_calendar (year, us_dst_start, us_dst_end)
      VALUES ({{params.year}}::int, {{params.us_dst_start}}, {{params.us_dst_end}})
      ON CONFLICT (year) DO UPDATE SET us_dst_start = EXCLUDED.us_dst_start, us_dst_end = EXCLUDED.us_dst_end;
    `,
  });
}

export default upsertDstCalendar;
