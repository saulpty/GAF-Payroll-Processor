import { action } from '@uibakery/data';

function upsertHoliday() {
  return action('upsertHoliday', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO holidays (date, name)
      SELECT {{params.date}}, {{params.name}} WHERE public.assert_super({{ user.email }}::text)
      ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name;
    `,
  });
}

export default upsertHoliday;
