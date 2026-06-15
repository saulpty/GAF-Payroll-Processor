import { action } from '@uibakery/data';

function loadDstCalendar() {
  return action('loadDstCalendar', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT year, us_dst_start::text AS us_dst_start, us_dst_end::text AS us_dst_end
      FROM dst_calendar
      ORDER BY year;
    `,
  });
}

export default loadDstCalendar;
