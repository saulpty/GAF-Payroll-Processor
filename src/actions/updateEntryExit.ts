import { action } from '@uibakery/data';

function updateEntryExit() {
  return action('updateEntryExit', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE payroll_entries SET
        entry_time = {{params.entry_time}},
        exit_time = {{params.exit_time}},
        updated_at = NOW()
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default updateEntryExit;
