import { action } from '@uibakery/data';

// Teramind's agent roster (whole company). Super-only callers: the Teramind admin tab.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindAgentDirectory() {
  return action('loadTeramindAgentDirectory', 'HTTP', {
    datasourceName: 'Teramind API',
    options: {
      method: 'GET',
      url: '/v1/agents',
      queryParams: { fields: 'name,email_address,deleted,online' },
    },
  });
}

export default loadTeramindAgentDirectory;
