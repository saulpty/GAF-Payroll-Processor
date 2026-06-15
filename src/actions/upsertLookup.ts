import { action } from '@uibakery/data';

// tableName must be one of the allowed lookup tables — validated at call site in AdminLookups.
// The SQL uses a CASE to map the table name to a safe hardcoded identifier,
// preventing any SQL injection via dynamic table names.
function upsertLookup() {
  return action('upsertLookup', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      DO $$
      DECLARE tbl text := {{params.tableName}};
      BEGIN
        IF tbl NOT IN ('event_types','pay_impacts','documentation_options') THEN
          RAISE EXCEPTION 'Invalid table name: %', tbl;
        END IF;
        IF tbl = 'event_types' THEN
          INSERT INTO event_types (name) VALUES ({{params.name}}) ON CONFLICT (name) DO NOTHING;
        ELSIF tbl = 'pay_impacts' THEN
          INSERT INTO pay_impacts (name) VALUES ({{params.name}}) ON CONFLICT (name) DO NOTHING;
        ELSIF tbl = 'documentation_options' THEN
          INSERT INTO documentation_options (name) VALUES ({{params.name}}) ON CONFLICT (name) DO NOTHING;
        END IF;
      END $$;
    `,
  });
}

export default upsertLookup;
