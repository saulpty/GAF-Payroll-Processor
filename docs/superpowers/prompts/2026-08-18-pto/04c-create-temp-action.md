Understood — the agent sandbox cannot POST, only the UI Bakery browser runtime can. So do not try to execute anything this time. Just create the file and stop; I will run it myself from the builder.

Create exactly ONE new file, `src/actions/debugMondayColumns.ts`. Change nothing else. Do not run it, do not add it to any page, do not import it anywhere, do not delete it.

Model it exactly on `src/actions/loadEmployeeDirectory.ts` — same import, same structure, same headers, `bodyType: 'raw'`, datasource `Monday.com API` — with this body, a single-line JSON string with the query inlined and no parameters at all:

{"query":"{ boards(ids: [18394590373, 9542698245, 8592460836, 8661565945]) { id name columns { id title type } } }"}

The function and the action name must both be `debugMondayColumns`, and it must have a default export, matching the convention of every other file in `src/actions/`.

This is a temporary diagnostic file. I will run it in the builder, read the result, and then ask you to delete it.

Acceptance: `src/actions/debugMondayColumns.ts` exists and is a valid action file; no other file in the project changed.
