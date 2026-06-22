import { action } from '@uibakery/data';

function loadHrkExports() {
  return action('loadHrkExports', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT id, period_name, exported_at, exported_by, summary_json
      FROM hrk_exports
      ORDER BY exported_at DESC;
    `,
  });
}

export default loadHrkExports;
