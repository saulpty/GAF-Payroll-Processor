import { action } from '@uibakery/data';

function updatePunchTimes() {
  return action('updatePunchTimes', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE payroll_entries SET
        entry_time = {{params.entry_time}},
        exit_time = {{params.exit_time}},
        late_minutes = {{params.late_minutes}}::int,
        late_after_grace = {{params.late_after_grace}}::int,
        early_leave_minutes = {{params.early_leave_minutes}}::int,
        updated_at = NOW()
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default updatePunchTimes;
