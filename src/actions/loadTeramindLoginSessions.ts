import { action } from '@uibakery/data';

// Login sessions for a date range, whole company, times in US Eastern.
// The cube cannot be filtered by agent (probe 2026-09-17: `in` is rejected, `range` silently
// returns nothing), so callers keep only linked agents before saving. Super-only callers.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindLoginSessions() {
  return action('loadTeramindLoginSessions', 'HTTP', {
    datasourceName: 'Teramind API',
    options: {
      method: 'POST',
      url: '/wip/tma-query',
      headers: { 'Content-Type': 'application/json' },
      bodyType: 'object',
      body: `{
        cube: "login_session",
        timezone: "America/New_York",
        aggregate: false,
        dims: ["agent", "date", "timestamp", "computer"],
        measures: ["time_s"],
        dim_filters: { date: { range: [{{params.dateFrom}}, {{params.dateTo}}] } },
        limit: 50000
      }`,
    },
  });
}

export default loadTeramindLoginSessions;
