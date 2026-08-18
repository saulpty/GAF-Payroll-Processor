import { action } from '@uibakery/data';

function upsertMondayContracts() {
  return action('upsertMondayContracts', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO monday_contracts (
        monday_item_id, employee_id, employee_name_raw, employee_email_raw,
        board_group, position, state, manager_raw,
        start_date, contract_end_date, raw, deleted_on_monday, synced_at
      )
      SELECT
        (r->>'monday_item_id')::bigint,
        NULLIF(r->>'employee_id', '')::bigint,
        r->>'employee_name_raw',
        r->>'employee_email_raw',
        r->>'board_group',
        r->>'position',
        r->>'state',
        r->>'manager_raw',
        NULLIF(r->>'start_date', '')::date,
        NULLIF(r->>'contract_end_date', '')::date,
        (r->'raw'),
        false,
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      ON CONFLICT (monday_item_id) DO UPDATE SET
        employee_id       = EXCLUDED.employee_id,
        employee_name_raw = EXCLUDED.employee_name_raw,
        employee_email_raw= EXCLUDED.employee_email_raw,
        board_group       = EXCLUDED.board_group,
        position          = EXCLUDED.position,
        state             = EXCLUDED.state,
        manager_raw       = EXCLUDED.manager_raw,
        start_date        = EXCLUDED.start_date,
        contract_end_date = EXCLUDED.contract_end_date,
        raw               = EXCLUDED.raw,
        deleted_on_monday = false,
        synced_at         = NOW();
    `,
  });
}

export default upsertMondayContracts;
