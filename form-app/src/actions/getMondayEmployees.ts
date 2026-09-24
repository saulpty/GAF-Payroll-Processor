import { action } from '@uibakery/data';

// Board 8592460836: Panama Employee Directory
// Columns used:
//   lookup_mkpteyp5 = Job Title
//   color_mkpt5gk4  = Branch
//   color_mkyjv6et  = Status (Active / Resigned / Offboarded)
//   text_mkzj84w1   = Manager name
//   text_mkzj8b73   = Manager Email
//   text_mm785e8r   = Manager 2 name
//   text_mm15y2vw   = Manager 2 Email
//   text_mm786kge   = Manager 3 name
//   text_mm78fxpg   = Manager 3 Email
//   text_mm78whj1   = Manager 4 name
//   text_mm78hgkr   = Manager 4 Email
function getMondayEmployees() {
  return action('getMondayEmployees', 'HTTP', {
    datasourceName: 'Monday.com API',
    options: {
      method: 'POST',
      url: '',
      headers: { 'Content-Type': 'application/json', 'API-Version': '2024-01' },
      bodyType: 'object',
      body: `{
        query: "{ boards(ids: [8592460836]) { items_page(limit: 500) { items { name group { id } column_values(ids: [\\"lookup_mkpteyp5\\", \\"color_mkpt5gk4\\", \\"color_mkyjv6et\\", \\"text_mkzj84w1\\", \\"text_mkzj8b73\\", \\"text_mm785e8r\\", \\"text_mm15y2vw\\", \\"text_mm786kge\\", \\"text_mm78fxpg\\", \\"text_mm78whj1\\", \\"text_mm78hgkr\\"]) { id text } } } } }"
      }`,
    },
  });
}

export default getMondayEmployees;
