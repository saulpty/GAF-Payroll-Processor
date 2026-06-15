import { action } from '@uibakery/data';

function pullMondayBoard() {
  return action('pullMondayBoard', 'HTTP', {
    datasourceName: 'Monday.com API',
    options: {
      method: 'POST',
      url: '',
      headers: {
        'Content-Type': 'application/json',
        'API-Version': '2024-01',
      },
      bodyType: 'object',
      body: `{
        query: {{params.query}},
        variables: {{params.variables}}
      }`,
    },
  });
}

export default pullMondayBoard;
