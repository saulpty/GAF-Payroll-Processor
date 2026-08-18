This is a READ-ONLY investigation task. Do NOT create, modify, rename or delete any file. Do not create an action, a component, a page or a migration. Do not change any datasource. If you cannot answer without creating or editing a file, stop and say so instead of creating one.

Using the existing `Monday.com API` datasource and the existing generic action `src/actions/pullMondayBoard.ts` (pass the whole query as `params.query`, exactly as `ProcessPayroll.tsx` already does — never place `{{params.…}}` inside a quoted string), run this single GraphQL query:

```
{ boards(ids: [18394590373, 9542698245, 8592460836, 8661565945]) { id name columns { id title type } } }
```

Then paste the COMPLETE result into the chat as plain text, formatted as one line per column in exactly this shape, grouped by board:

```
BOARD <id> "<board name>"
  <column id>  |  <column title>  |  <column type>
```

Include every column of every board — do not truncate, summarise, sort, rename, or omit any column, even ones that look irrelevant. If a board id returns nothing or errors, say so explicitly for that board rather than skipping it silently.

Two of these board ids are uncertain and I need to know the truth rather than an assumption:
- 8592460836 and 8661565945 are both candidates for the employee directory / onboarding boards. Report each board's real `name` exactly as Monday returns it so I can tell which is which.

Acceptance: the chat contains the full column list for every board that responded, and `git`-visible project files are completely unchanged.
