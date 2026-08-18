import { action } from '@uibakery/data';

function updateMondayRequestsDeleted() {
  return action('updateMondayRequestsDeleted', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE monday_requests
      SET deleted_on_monday = NOT (
        monday_item_id IN (
          SELECT (jsonb_array_elements_text({{params.seen_ids}}::jsonb))::bigint
        )
      );
    `,
  });
}

export default updateMondayRequestsDeleted;
