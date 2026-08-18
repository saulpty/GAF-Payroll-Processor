import { action } from '@uibakery/data';

function upsertMondayRequests() {
  return action('upsertMondayRequests', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO monday_requests (
        monday_item_id, employee_id, employee_name_raw, employee_email_raw,
        manager_email_raw, board_group, request_type, permission_type,
        start_date, end_date, return_date, start_datetime, end_datetime,
        total_days_requested, hours_approved, reason, details,
        submitted_at, raw, deleted_on_monday, synced_at
      )
      SELECT
        (r->>'monday_item_id')::bigint,
        NULLIF(r->>'employee_id', '')::bigint,
        r->>'employee_name_raw',
        r->>'employee_email_raw',
        r->>'manager_email_raw',
        r->>'board_group',
        r->>'request_type',
        r->>'permission_type',
        NULLIF(r->>'start_date', '')::date,
        NULLIF(r->>'end_date', '')::date,
        NULLIF(r->>'return_date', '')::date,
        r->>'start_datetime',
        r->>'end_datetime',
        NULLIF(r->>'total_days_requested', '')::numeric,
        NULLIF(r->>'hours_approved', '')::numeric,
        r->>'reason',
        r->>'details',
        r->>'submitted_at',
        (r->'raw'),
        false,
        NOW()
      FROM jsonb_array_elements({{params.rows}}::jsonb) AS r
      ON CONFLICT (monday_item_id) DO UPDATE SET
        employee_id          = EXCLUDED.employee_id,
        employee_name_raw    = EXCLUDED.employee_name_raw,
        employee_email_raw   = EXCLUDED.employee_email_raw,
        manager_email_raw    = EXCLUDED.manager_email_raw,
        board_group          = EXCLUDED.board_group,
        request_type         = EXCLUDED.request_type,
        permission_type      = EXCLUDED.permission_type,
        start_date           = EXCLUDED.start_date,
        end_date             = EXCLUDED.end_date,
        return_date          = EXCLUDED.return_date,
        start_datetime       = EXCLUDED.start_datetime,
        end_datetime         = EXCLUDED.end_datetime,
        total_days_requested = EXCLUDED.total_days_requested,
        hours_approved       = EXCLUDED.hours_approved,
        reason               = EXCLUDED.reason,
        details              = EXCLUDED.details,
        submitted_at         = EXCLUDED.submitted_at,
        raw                  = EXCLUDED.raw,
        deleted_on_monday    = false,
        synced_at            = NOW();
    `,
  });
}

export default upsertMondayRequests;
