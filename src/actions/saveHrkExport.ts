import { action } from '@uibakery/data';

function saveHrkExport() {
  return action('saveHrkExport', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO hrk_exports (period_name, exported_by, summary_json)
      SELECT {{params.periodName}}, {{params.exportedBy}}, {{params.summaryJson}}
      WHERE public.assert_super({{ user.email }}::text);
    `,
  });
}

export default saveHrkExport;
