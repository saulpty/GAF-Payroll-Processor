import { action } from '@uibakery/data';

function updateMondayContractsDeleted() {
  return action('updateMondayContractsDeleted', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      UPDATE monday_contracts
      SET deleted_on_monday = NOT (
        monday_item_id IN (
          SELECT (jsonb_array_elements_text({{params.seen_ids}}::jsonb))::bigint
        )
      );
    `,
  });
}

export default updateMondayContractsDeleted;
