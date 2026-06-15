import { action } from '@uibakery/data';

function loadSchedules() {
  return action('loadSchedules', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `SELECT id, schedule_name, dst_start, dst_end, standard_start, standard_end, grace_minutes, notes FROM schedules ORDER BY id;`,
  });
}

export default loadSchedules;
