import { action } from '@uibakery/data';

// tableName must be one of the allowed lookup tables.
// Uses a CASE-based guard to prevent SQL injection via dynamic table names.
function deleteLookup() {
  return action('deleteLookup', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      DO $$
      DECLARE tbl text := {{params.tableName}};
      BEGIN
        IF tbl NOT IN ('event_types','pay_impacts','documentation_options') THEN
          RAISE EXCEPTION 'Invalid table name: %', tbl;
        END IF;
        IF tbl = 'event_types' THEN
          DELETE FROM event_types WHERE id = {{params.id}}::bigint;
        ELSIF tbl = 'pay_impacts' THEN
          DELETE FROM pay_impacts WHERE id = {{params.id}}::bigint;
        ELSIF tbl = 'documentation_options' THEN
          DELETE FROM documentation_options WHERE id = {{params.id}}::bigint;
        END IF;
      END $$;
    `,
  });
}

export default deleteLookup;
