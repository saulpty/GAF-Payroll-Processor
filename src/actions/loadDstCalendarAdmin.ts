import { action } from '@uibakery/data';

function loadDstCalendarAdmin() {
  return action('loadDstCalendarAdmin', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `SELECT id, year, us_dst_start::text AS us_dst_start, us_dst_end::text AS us_dst_end FROM dst_calendar ORDER BY year;`,
  });
}

export default loadDstCalendarAdmin;
