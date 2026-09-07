# Which exact string does `datasourceName` need for the disciplinary database?

**Write no files. Create nothing. Modify nothing. Delete nothing.** Read-only,
like the two probes before it. Do not create an action to answer this.

## Why this is being asked separately

Three different names are in play for what appears to be one database, and an
action that names the wrong one fails at runtime with nothing to see in a diff:

| Where | String |
|---|---|
| The connections screen in this app | `SAUL Disciplinary Action Forms DB` |
| This app's exported `datasources.yml` | **`GA Offer Letter DB v2`** |
| The *other* app's actions, against the same data | `SAUL GA Offer Letter DB` |

The export is the new evidence. After the disciplinary database was connected,
`datasources.yml` gained the line `- GA Offer Letter DB v2` — **not** the name
shown on the connections screen.

For every existing action in this app the two agree: `datasourceName:
'GAF Planilla DB'` matches the `- GAF Planilla DB` line, and `'Monday.com API'`
matches its line. So `datasources.yml` looks authoritative — but the other
application contradicts that, because its actions say `SAUL GA Offer Letter DB`
while its own `datasources.yml` says `GA Offer Letter DB v2`, and that
application works in production every day.

Four actions are about to be written against this database. Getting the string
wrong is the 2026-08-11 failure mode all over again: clean diff, passing tests,
and a page that silently shows nothing.

## What to report

1. **List every datasource connected to this app**, with the exact string that a
   `datasourceName` field must contain for each. If UI Bakery distinguishes a
   display name from the identifier used in code, show both columns and say
   which one goes in an action.

2. **State the one exact string** that a new SQL action in this app must use to
   query `disciplinary_actions`. Quote it precisely, including capitalisation and
   spacing.

3. **Prove it**, by running this against that datasource and reporting the
   number:

   ```sql
   SELECT count(*) AS actions FROM disciplinary_actions;
   ```

   It should return **16**. If it returns anything else, say so.

4. **Say whether `SAUL Disciplinary Action Forms DB` and `GA Offer Letter DB v2`
   are the same connection under two names, or two separate connections.** If
   they are two, say which one holds `disciplinary_actions` — and whether the
   other one also does.

5. Confirm whether `GAF Planilla DB` and the disciplinary datasource are
   **separate Postgres instances**, i.e. whether a single SQL action could ever
   join `disciplinary_actions` to `employees`. The design assumes it cannot and
   does the join in React instead; if that assumption is wrong the design gets
   simpler, so it is worth knowing.

## Acceptance

1. No file was created, modified or deleted.
2. The reply names **one** exact string for `datasourceName`, quoted.
3. The count query ran against that string and returned a number.
4. Question 4 is answered plainly — same connection, or two.
