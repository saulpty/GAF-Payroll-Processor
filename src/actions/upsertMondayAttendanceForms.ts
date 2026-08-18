import { action } from '@uibakery/data';

function upsertMondayAttendanceForms() {
  return action('upsertMondayAttendanceForms', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO monday_attendance_forms (
        monday_item_id, employee_id, employee_name_raw, employee_email_raw,
        board_group, form_type, reason, details, eta, form_date,
        submitted_at, raw, deleted_on_monday, synced_at
      )
      SELECT
        (r->>'monday_item_id')::bigint,
        NULLIF(r->>'employee_id', '')::bigint,
        r->>'employee_name_raw',
        r->>'employee_email_raw',
        r->>'board_group',
        r->>'form_type',
        r->>'reason',
        r->>'details',
        r->>'eta',
        NULLIF(r->>'form_date', '')::date,
        r->>'submitted_at',
        (r->'raw'),
        false,
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      ON CONFLICT (monday_item_id) DO UPDATE SET
        employee_id       = EXCLUDED.employee_id,
        employee_name_raw = EXCLUDED.employee_name_raw,
        employee_email_raw= EXCLUDED.employee_email_raw,
        board_group       = EXCLUDED.board_group,
        form_type         = EXCLUDED.form_type,
        reason            = EXCLUDED.reason,
        details           = EXCLUDED.details,
        eta               = EXCLUDED.eta,
        form_date         = EXCLUDED.form_date,
        submitted_at      = EXCLUDED.submitted_at,
        raw               = EXCLUDED.raw,
        deleted_on_monday = false,
        synced_at         = NOW();
    `,
  });
}

export default upsertMondayAttendanceForms;
