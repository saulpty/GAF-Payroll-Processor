# 07 — Hub probe: can this app see the admins list and the email connection?

> **Goes into GAF Panama HR Hub** (the Hub), not the Disciplinary Actions Form.
> Run it only **after** the form-app prompts 01–06 are done (the table
> `disciplinary_admins` and the three new columns are created by the form's 02 migration).

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**This is a read-only probe. Nothing permanent may change.** Do not edit any page,
component, lib, context, migration or existing action. Do not "helpfully" start building
the edit feature. Do not send any email. Do not run any UPDATE, INSERT or DELETE.

If a query can only run from a saved action, you may create **one temporary action**,
`src/actions/probeDisciplinaryAccess.ts`, run it, report the result, and then **delete it**.
When you finish, the project must be exactly as it was: the next export must show
`added: 0, changed: 0`.

## Why

Next, the Hub gets four new actions for editing a disciplinary warning. Two of them rely on
things this app has never used:

1. The table **`disciplinary_admins`**, in the **`SAUL Disciplinary Action Forms DB`**
   datasource (the form app's database, which this app already reads for the Disciplinary
   page). It lists the two people allowed to edit and delete: Tim and Saul.
2. The **`Email Passiontocare`** datasource (Microsoft Graph, used by the form app to email
   the PDF). The Hub's exported `datasources.yml` does **not** list it today, so it may not
   be connected to this app.

An action that names a datasource the app can't reach fails at runtime, with nothing visible
in the code. This probe finds out first.

## Query 1 — the admins list

Against **`SAUL Disciplinary Action Forms DB`** (that exact string, as used by
`src/actions/loadDisciplinaryActions.ts`):

```sql
SELECT email, name FROM disciplinary_admins ORDER BY email;
```

Expected: 2 rows, `saul.f@vitasyahc.com` (Saul Fallembaum) and `tim.m@vitasyahc.com`
(Timothy Moore), both lower-case.

## Query 2 — does `{{ user.email }}` reach this datasource?

Same datasource. This one needs `{{ user.email }}`, so it may need the temporary action:

```sql
SELECT lower(btrim({{ user.email }})) AS me,
       EXISTS (SELECT 1 FROM disciplinary_admins a
               WHERE a.email = lower(btrim({{ user.email }}))) AS is_admin;
```

Report `me` and `is_admin` exactly as returned. If you run it signed in as Saul,
`is_admin` should be `true`. If `{{ user.email }}` comes back empty or the query errors,
say so plainly — that changes the design.

## Query 3 — the new columns exist

Same datasource:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'disciplinary_actions'
  AND column_name IN ('edited_at', 'edited_by', 'pdf_en_original_base64',
                      'pdf_en_base64', 'deleted_at')
ORDER BY column_name;
```

Expected: 5 rows. Report any that are missing.

## Query 4 — how many warnings have a stored PDF

Same datasource. Counts only; **never select the base64 columns themselves** (one row is
about 250 KB).

```sql
SELECT count(*)                                              AS actions,
       count(*) FILTER (WHERE pdf_en_base64 IS NOT NULL)     AS with_pdf,
       count(*) FILTER (WHERE pdf_en_original_base64 IS NOT NULL) AS with_original,
       count(*) FILTER (WHERE deleted_at IS NOT NULL)        AS deleted
FROM disciplinary_actions;
```

## Question 5 — is `Email Passiontocare` available to this app?

**Do not send anything.** Answer from the datasource list:

- List **every datasource this app can use**, with the exact string a `datasourceName`
  must contain for each.
- Say whether **`Email Passiontocare`** is on that list, spelled exactly like that.
- If it is not on the list, say whether it exists in the workspace and only needs to be
  connected to this app (and where that is done), or whether it cannot be reached at all.

## Clean-up

If you created `src/actions/probeDisciplinaryAccess.ts`, delete it now and confirm it is gone.

## Report back

Fill in this table in your reply, then add anything surprising underneath.

| # | Question | Result |
|---|---|---|
| 1 | Rows in `disciplinary_admins` (email, name) | |
| 2 | `me` / `is_admin` for the signed-in user | |
| 3 | Missing columns (if any) | |
| 4 | actions / with_pdf / with_original / deleted | |
| 5a | Exact `datasourceName` strings available to this app | |
| 5b | `Email Passiontocare` connected to this app? (yes / no / exists but not connected) | |
| 6 | Was a temporary action created? If so, confirm it was deleted | |

## Acceptance

1. No file in the project was created, changed or deleted by the end (the export is 0/0).
2. Every query above ran, or the reply says exactly why one could not.
3. Question 5 is answered with a plain yes or no for `Email Passiontocare`.
4. No email was sent and no row was changed.

---

## Operator notes (Claude, not UIB)

- Save the answers as `07-hub-probe-RESULTS.md` next to this file.
- If 5b is **no**, Saul connects `Email Passiontocare` to the Hub on the UIB connections
  screen before prompt 09. That adds one line to `datasources.yml` in the next export;
  that line is expected.
- If Query 2 shows `is_admin = false` for Saul, stop: the form migration's seed or the
  e-mail casing is wrong, and every lock in 09 would refuse Saul too.
