import { action } from '@uibakery/data';

// One page of Teramind's Time Records grid — the screen payroll's export file has always come
// from. Live for today, filtered to the agent ids we pass, exact instants in `period`.
// `agents` is an array of numbers and is substituted whole. Super-only callers.
// `manager` is accepted for the house rule that every load* takes one; it is not used.
function loadTeramindTimeRecords() {
  return action('loadTeramindTimeRecords', 'HTTP', {
    datasourceName: 'Teramind API',
    options: {
      method: 'POST',
      url: '/tt/r/time-records/grid',
      headers: { 'Content-Type': 'application/json' },
      bodyType: 'object',
      body: `{
        agents: {{params.agents}},
        departments: [],
        computers: [],
        tasks: [],
        filter: "",
        page: {{params.page}},
        pageSize: {{params.pageSize}},
        periodStart: {{params.periodStart}},
        periodEnd: {{params.periodEnd}},
        customFilter: [],
        partial: 0
      }`,
    },
  });
}

export default loadTeramindTimeRecords;
