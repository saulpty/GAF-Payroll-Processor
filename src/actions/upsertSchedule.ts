import { action } from '@uibakery/data';

function upsertSchedule() {
  return action('upsertSchedule', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO schedules (schedule_name, dst_start, dst_end, standard_start, standard_end, grace_minutes, notes)
      VALUES ({{params.schedule_name}}, {{params.dst_start}}, {{params.dst_end}},
              {{params.standard_start}}, {{params.standard_end}}, {{params.grace_minutes}}::int, {{params.notes}})
      ON CONFLICT (schedule_name) DO UPDATE SET
        dst_start = EXCLUDED.dst_start, dst_end = EXCLUDED.dst_end,
        standard_start = EXCLUDED.standard_start, standard_end = EXCLUDED.standard_end,
        grace_minutes = EXCLUDED.grace_minutes, notes = EXCLUDED.notes;
    `,
  });
}

export default upsertSchedule;
