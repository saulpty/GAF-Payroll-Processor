import { action } from '@uibakery/data';

function upsertPtoEmployee() {
  return action('upsertPtoEmployee', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO pto_employees (employee_id, paid_pto_days, pto_start_date_override)
      VALUES ({{params.employee_id}}, {{params.paid_pto_days}}, NULLIF({{params.pto_start_date_override}}, '')::date)
      ON CONFLICT (employee_id) DO UPDATE SET
        paid_pto_days = EXCLUDED.paid_pto_days,
        pto_start_date_override = EXCLUDED.pto_start_date_override,
        updated_at = NOW()
    `,
  });
}

export default upsertPtoEmployee;
