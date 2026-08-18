import { action } from '@uibakery/data';

function loadMondayUnmatched() {
  return action('loadMondayUnmatched', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT 'requests' AS source, monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at
      FROM monday_requests
      WHERE employee_id IS NULL AND deleted_on_monday = false
      UNION ALL
      SELECT 'attendance_forms', monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at
      FROM monday_attendance_forms
      WHERE employee_id IS NULL AND deleted_on_monday = false
      UNION ALL
      SELECT 'contracts', monday_item_id, employee_name_raw, employee_email_raw, board_group, synced_at
      FROM monday_contracts
      WHERE employee_id IS NULL AND deleted_on_monday = false
      ORDER BY employee_name_raw, source
    `,
  });
}

export default loadMondayUnmatched;
