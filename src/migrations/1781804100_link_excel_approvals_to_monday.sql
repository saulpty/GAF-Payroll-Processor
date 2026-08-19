-- PTO rows imported from the Excel tracker carry no monday_item_id, so the
-- matching Monday request still shows as pending in the app. Link each Excel
-- row to the request with the same employee and leave date. Idempotent; never
-- links two rows to one Monday item.
UPDATE pto_approvals a
SET    monday_item_id = r.monday_item_id,
       source         = 'monday',
       updated_at     = NOW()
FROM   monday_requests r
WHERE  a.monday_item_id IS NULL
  AND  a.source = 'excel_import'
  AND  r.request_type = 'PTO / Vacation'
  AND  r.deleted_on_monday = false
  AND  r.employee_id = a.employee_id
  AND  r.start_date  = a.leave_on
  AND  NOT EXISTS (SELECT 1 FROM pto_approvals x WHERE x.monday_item_id = r.monday_item_id);
