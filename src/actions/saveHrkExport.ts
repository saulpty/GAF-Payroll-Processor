import { action } from '@uibakery/data';

function saveHrkExport() {
  return action('saveHrkExport', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO hrk_exports (period_name, exported_by, summary_json)
      VALUES ({{params.periodName}}, {{params.exportedBy}}, {{params.summaryJson}});
    `,
  });
}

export default saveHrkExport;
