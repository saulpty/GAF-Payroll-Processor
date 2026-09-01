import { action } from '@uibakery/data';

function loadContractMilestones() {
  return action('loadContractMilestones', 'SQL', {
    datasourceName: 'GAF Planilla DB',
    query: `
      SELECT e.id                          AS employee_id,
             e.display_name,
             COALESCE(e.role, '')          AS role,
             COALESCE(e.manager, '')       AS manager,
             e.start_date::text            AS roster_start,
             c.start_date::text            AS board_start,
             c.position,
             c.state,
             c.contract_end_date::text     AS contract_end,
             (c.monday_item_id IS NOT NULL) AS has_board_row
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT mc.*
        FROM monday_contracts mc
        WHERE mc.employee_id = e.id
          AND mc.deleted_on_monday = false
        ORDER BY mc.start_date DESC NULLS LAST
        LIMIT 1
      ) c ON true
      WHERE e.active = true
        AND ({{params.manager}} IS NULL OR {{params.manager}} = '' OR e.manager = {{params.manager}})
        AND ({{params.employeeId}} IS NULL OR {{params.employeeId}} = '' OR e.id::text = {{params.employeeId}}::text)
      ORDER BY e.display_name;
    `,
  });
}

export default loadContractMilestones;
