import { action } from '@uibakery/data';

function softDeleteStaleEntries() {
  return action('softDeleteStaleEntries', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE payroll_entries pe
      SET deleted_at = NOW(),
          deleted_by = {{params.deleted_by}}
      WHERE pe.period_name = {{params.period_name}}
        AND pe.deleted_at IS NULL
        AND LEFT(pe.work_date, 10) BETWEEN {{params.start_date}} AND {{params.end_date}}
        AND pe.employee_id = ANY(string_to_array({{params.employee_ids}}, ',')::bigint[])
        AND (pe.employee_id || ':' || LEFT(pe.work_date, 10))
            <> ALL (string_to_array({{params.kept_keys}}, ','))
      RETURNING pe.id;
    `,
  });
}

export default softDeleteStaleEntries;
