import { action } from '@uibakery/data';

function loadDstCalendar() {
  return action('loadDstCalendar', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT year,
             to_char(us_dst_start, 'YYYY-MM-DD') AS us_dst_start,
             to_char(us_dst_end, 'YYYY-MM-DD') AS us_dst_end
      FROM dst_calendar
      ORDER BY year;
    `,
  });
}

export default loadDstCalendar;
