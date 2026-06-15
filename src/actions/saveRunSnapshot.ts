import { action } from '@uibakery/data';

function saveRunSnapshot() {
  return action('saveRunSnapshot', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO run_snapshots (period_name, snapshot_type, raw_data)
      VALUES ({{params.periodName}}, {{params.snapshotType}}, {{params.rawData}});
    `,
  });
}

export default saveRunSnapshot;
