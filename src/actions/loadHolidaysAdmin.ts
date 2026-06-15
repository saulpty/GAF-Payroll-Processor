import { action } from '@uibakery/data';

function loadHolidaysAdmin() {
  return action('loadHolidaysAdmin', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `SELECT id, date::text AS date, name FROM holidays ORDER BY date;`,
  });
}

export default loadHolidaysAdmin;
