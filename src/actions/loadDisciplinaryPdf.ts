import { action } from '@uibakery/data';

// The stored PDFs of ONE disciplinary action, for the Download buttons.
// Heavy (about 250 KB of base64 per column), so it is called on a click through
// useMutateAction, never on page load. pdf_en_original_base64 is set only after
// the first Hub edit and keeps the PDF the manager filed.
function loadDisciplinaryPdf() {
  return action('loadDisciplinaryPdf', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT id, ref, pdf_en_base64, pdf_en_original_base64
      FROM disciplinary_actions
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL;
    `,
  });
}

export default loadDisciplinaryPdf;
