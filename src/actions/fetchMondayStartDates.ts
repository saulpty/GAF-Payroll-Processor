import { action } from '@uibakery/data';

function fetchMondayStartDates() {
  return action('fetchMondayStartDates', 'HTTP', {
    datasourceName: 'Monday.com API',
    options: {
      method: 'POST',
      url: '',
      headers: {
        'Content-Type': 'application/json',
        'API-Version': '2024-01',
      },
      bodyType: 'raw',
      body: '{"query":"{ boards(ids: [8661565945]) { columns { id title type } items_page(limit: 500) { items { name column_values { id text value } } } } }"}',
    },
  });
}

export default fetchMondayStartDates;
