import { action } from '@uibakery/data';

function upsertEventTypeRule() {
  return action('upsertEventTypeRule', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO event_type_rules (event_type, default_pay_impact, default_doc_option, notes)
      VALUES (
        {{params.event_type}},
        {{params.default_pay_impact}},
        {{params.default_doc_option}},
        {{params.notes}}
      )
      ON CONFLICT (event_type) DO UPDATE SET
        default_pay_impact  = EXCLUDED.default_pay_impact,
        default_doc_option  = EXCLUDED.default_doc_option,
        notes               = EXCLUDED.notes,
        updated_at          = NOW();
    `,
  });
}

export default upsertEventTypeRule;
