import { action } from '@uibakery/data';

function upsertTeramindPullLog() {
  return action('upsertTeramindPullLog', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      INSERT INTO teramind_pull_log (
        date_from, date_to, pulled_by, trigger, agent_count, row_count, saved_count,
        truncated, error, source
      )
      SELECT
        {{params.date_from}}::text,
        {{params.date_to}}::text,
        {{params.pulled_by}}::text,
        {{params.trigger}}::text,
        {{params.agent_count}}::int,
        {{params.row_count}}::int,
        {{params.saved_count}}::int,
        {{params.truncated}}::boolean,
        NULLIF({{params.error}}::text, ''),
        COALESCE(NULLIF({{params.source}}::text, ''), 'login_session')
      WHERE public.assert_super({{ user.email }}::text)
      RETURNING id;
    `,
  });
}

export default upsertTeramindPullLog;
