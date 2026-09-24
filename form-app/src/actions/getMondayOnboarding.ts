import { action } from '@uibakery/data';

// Board 8661565945: Employee Onboarding / Managers
// Columns used: name (employee name), text_mkptja09 (manager name),
//   email_mktc7p9z (manager email), text (position/role)
function getMondayOnboarding() {
  return action('getMondayOnboarding', 'HTTP', {
    datasourceName: 'Monday.com API',
    options: {
      method: 'POST',
      url: '',
      headers: { 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      bodyType: 'object',
      body: `{
        query: "{ boards(ids: [8661565945]) { items_page(limit: 500) { items { name column_values(ids: [\\"text_mkptja09\\", \\"email_mktc7p9z\\", \\"text\\"]) { id text } } } } }"
      }`,
    },
  });
}

export default getMondayOnboarding;
