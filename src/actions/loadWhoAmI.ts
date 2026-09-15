import { action } from '@uibakery/data';

function loadWhoAmI() {
  return action('loadWhoAmI', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT {{ user.email }} AS email;
    `,
  });
}

export default loadWhoAmI;
