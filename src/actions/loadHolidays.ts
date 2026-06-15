import { action } from '@uibakery/data';

function loadHolidays() {
  return action('loadHolidays', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT date::text AS date, name FROM holidays ORDER BY date;
    `,
  });
}

export default loadHolidays;
