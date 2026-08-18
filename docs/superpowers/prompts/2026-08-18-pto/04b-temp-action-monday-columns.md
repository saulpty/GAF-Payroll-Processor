You correctly reported that you cannot POST to Monday without a file. This task explicitly authorises exactly one temporary file, created and then deleted within this same task. Nothing else may change.

Do all four steps in order:

STEP 1 — Create ONE new file, `src/actions/debugMondayColumns.ts`, an HTTP action against the `Monday.com API` datasource. Model it exactly on `src/actions/loadEmployeeDirectory.ts` (bodyType 'raw', same headers). Its body is this single-line JSON with the query inlined — no `{{params.…}}` anywhere, because nothing will call it with parameters:

{"query":"{ boards(ids: [18394590373, 9542698245, 8592460836, 8661565945]) { id name columns { id title type } } }"}

STEP 2 — Execute that action once and capture the full JSON response.

STEP 3 — Paste the COMPLETE result into the chat as plain text. Format it as one line per column, grouped by board, in exactly this shape and nothing else:

BOARD <board id> = <board name>
<column id> = <column title> = <column type>

Rules for this output, all of which matter to me:
- Include EVERY column of EVERY board. Do not truncate, sort, summarise, rename, deduplicate, or omit any column, however irrelevant it looks.
- Do NOT include any URL, any token, any http link, or the raw JSON envelope — just the lines above. (Long URLs cause the output to be filtered out before I can read it.)
- If a board id errors or returns nothing, write `BOARD <id> = ERROR: <message>` for it rather than skipping it silently.
- Report each board's real `name` exactly as Monday returns it. Two of these ids, 8592460836 and 8661565945, are of uncertain purpose and I need to see their true names.

STEP 4 — Delete `src/actions/debugMondayColumns.ts` completely. It must not exist when you finish.

Acceptance: the chat contains the full column list for every board; `src/actions/debugMondayColumns.ts` does not exist; and no other file in the project was created, modified or deleted. A diff of the project against its state before this task must be empty.
