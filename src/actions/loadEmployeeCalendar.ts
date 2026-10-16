import { action } from '@uibakery/data';

function loadEmployeeCalendar() {
  return action('loadEmployeeCalendar', 'HTTP', {
    datasourceName: 'Microsoft API',
    options: {
      method: 'GET',
      url: 'v1.0/users/{{params.email}}/calendarView',
      queryParams: {
        startDateTime: '{{params.start}}',
        endDateTime: '{{params.end}}',
        $select: 'subject,start,end,isAllDay,showAs,organizer',
        $top: '100',
      },
    },
  });
}

export default loadEmployeeCalendar;
