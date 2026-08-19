import { action } from '@uibakery/data';

function upsertFloatingHoliday() {
  return action('upsertFloatingHoliday', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO pto_floating_holidays (employee_id, calendar_year, fh_allocated, fh_used, notes)
      VALUES ({{params.employee_id}}, {{params.calendar_year}}, {{params.fh_allocated}}, {{params.fh_used}}, {{params.notes}})
      ON CONFLICT (employee_id, calendar_year) DO UPDATE SET
        fh_allocated = EXCLUDED.fh_allocated,
        fh_used      = EXCLUDED.fh_used,
        notes        = EXCLUDED.notes,
        updated_at   = NOW()
    `,
  });
}

export default upsertFloatingHoliday;
