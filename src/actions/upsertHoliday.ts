import { action } from '@uibakery/data';

function upsertHoliday() {
  return action('upsertHoliday', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO holidays (date, name) VALUES ({{params.date}}, {{params.name}})
      ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name;
    `,
  });
}

export default upsertHoliday;
