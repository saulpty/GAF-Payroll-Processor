import { action } from '@uibakery/data';

function updatePayrollEntry() {
  return action('updatePayrollEntry', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE payroll_entries SET
        event_type_1 = {{params.event_type_1}},
        pay_impact_1 = {{params.pay_impact_1}},
        event_type_2 = {{params.event_type_2}},
        pay_impact_2 = {{params.pay_impact_2}},
        documentation = {{params.documentation}},
        notes = {{params.notes}},
        discount_total_minutes = {{params.discount_total_minutes}}::int,
        payroll_ready = {{params.payroll_ready}},
        status_current = {{params.status_current}},
        updated_at = NOW()
      WHERE id = {{params.id}}::bigint;
    `,
  });
}

export default updatePayrollEntry;
