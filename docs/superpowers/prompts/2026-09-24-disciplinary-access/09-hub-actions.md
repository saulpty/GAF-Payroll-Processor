# 09 — Hub: the disciplinary edit actions, and Tim-and-Saul-only locks on delete and restore

> **Goes into GAF Panama HR Hub** (the Hub), not the Disciplinary Actions Form.
> Run after 07 (the probe) confirmed `disciplinary_admins` is readable and
> `Email Passiontocare` is available to this app.

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only these 7 files may change. No other file may be touched.**

- New: `src/actions/loadDisciplinaryAdmin.ts`
- New: `src/actions/loadDisciplinaryPdf.ts`
- New: `src/actions/updateDisciplinaryAction.ts`
- New: `src/actions/sendDisciplinaryUpdatedEmail.ts`
- Edit: `src/actions/updateDisciplinaryActionDeleted.ts`
- Edit: `src/actions/updateDisciplinaryActionRestored.ts`
- Edit: `src/actions/loadDisciplinaryActions.ts`

Do not edit any page, component, lib, context or migration. No migration: the table and
columns belong to the form app and already exist. Do not touch
`updateDisciplinaryActionClosed.ts`, `updateDisciplinaryActionReopened.ts` or
`loadDisciplinaryDueCount.ts`. One action per file.

## Why

Saul's decision: only **Tim and Saul** may edit, delete or restore a disciplinary warning.
They are the two rows of `disciplinary_admins` in the **`SAUL Disciplinary Action Forms DB`**
datasource. The check must run **inside the database**, using `{{ user.email }}` (which UI
Bakery fills in on the server; the browser cannot fake it). Hiding buttons alone is not a lock.

`public.assert_super` cannot be used: it lives in `GAF Planilla DB`, and one SQL action can
only talk to one datasource. So every lock here is written as:

```sql
AND EXISTS (SELECT 1 FROM disciplinary_admins a WHERE a.email = lower(btrim({{ user.email }})))
```

When the person is not an admin, the statement changes **0 rows** and returns nothing. The UI
(next prompt) shows "Not allowed" when that happens.

## Rules for every SQL below

- The datasource string is exactly `'SAUL Disciplinary Action Forms DB'`.
- `{{params.x}}` and `{{ user.email }}` are **never** inside quotes. Copy the SQL exactly.
- Never select `pdf_en_base64` in `loadDisciplinaryActions` (one row is ~250 KB). Only
  `loadDisciplinaryPdf` returns the base64, one row at a time, on a click.

## 1. New file `src/actions/loadDisciplinaryAdmin.ts` (verbatim)

```ts
import { action } from '@uibakery/data';

// Is the signed-in person a disciplinary admin (Tim or Saul)? The list is the
// disciplinary_admins table in the form app's database. {{ user.email }} is
// filled in by UI Bakery on the server, so the browser cannot claim to be
// someone else. The UI uses this only to show or hide buttons; the real lock is
// the same EXISTS inside every edit, delete and restore statement.
function loadDisciplinaryAdmin() {
  return action('loadDisciplinaryAdmin', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT EXISTS (
               SELECT 1 FROM disciplinary_admins a
               WHERE a.email = lower(btrim({{ user.email }}))
             ) AS is_admin;
    `,
  });
}

export default loadDisciplinaryAdmin;
```

## 2. New file `src/actions/loadDisciplinaryPdf.ts` (verbatim)

```ts
import { action } from '@uibakery/data';

// The stored PDFs of ONE disciplinary action, for the Download buttons.
// Heavy (about 250 KB of base64 per column), so it is called on a click through
// useMutateAction, never on page load. pdf_en_original_base64 is set only after
// the first Hub edit and keeps the PDF the manager filed.
function loadDisciplinaryPdf() {
  return action('loadDisciplinaryPdf', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      SELECT id, ref, pdf_en_base64, pdf_en_original_base64
      FROM disciplinary_actions
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL;
    `,
  });
}

export default loadDisciplinaryPdf;
```

## 3. New file `src/actions/updateDisciplinaryAction.ts` (verbatim)

```ts
import { action } from '@uibakery/data';

// Saves a Hub edit of one disciplinary action (Tim and Saul only: the EXISTS
// on disciplinary_admins is checked in the database). Employee, manager and
// ref are NOT editable; to change who a warning is about, delete it and file a
// new one. The first edit copies the filed PDF into pdf_en_original_base64
// (COALESCE keeps it on later edits); the new PDF is built in the browser.
// Zero rows returned = not allowed, or the action was deleted meanwhile.
function updateDisciplinaryAction() {
  return action('updateDisciplinaryAction', 'SQL', {
    datasourceName: 'SAUL Disciplinary Action Forms DB',
    query: `
      UPDATE disciplinary_actions
      SET document_date          = {{params.documentDate}}::date,
          revaluation_date       = {{params.revaluationDate}}::date,
          warning_level          = {{params.warningLevel}},
          final_outcome          = {{params.finalOutcome}},
          scenario               = {{params.scenario}},
          q_expected             = {{params.qExpected}},
          q_happened             = {{params.qHappened}},
          q_when                 = {{params.qWhen}},
          q_impact               = {{params.qImpact}},
          evidence_types         = ARRAY(SELECT jsonb_array_elements_text({{params.evidenceTypes}}::jsonb)),
          evidence_description   = {{params.evidenceDescription}},
          prior_warnings         = {{params.priorWarnings}},
          expectations           = {{params.expectations}},
          consequences           = {{params.consequences}},
          employee_role          = {{params.employeeRole}},
          employee_branch        = {{params.employeeBranch}},
          pdf_en_original_base64 = COALESCE(pdf_en_original_base64, pdf_en_base64),
          pdf_en_base64          = {{params.pdf}},
          edited_at              = NOW(),
          edited_by              = lower(btrim({{ user.email }}))
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM disciplinary_admins a WHERE a.email = lower(btrim({{ user.email }})))
      RETURNING id, ref, manager_email, manager_name, employee_name;
    `,
  });
}

export default updateDisciplinaryAction;
```

Parameters, for the next prompt: `id`, `documentDate` (`'YYYY-MM-DD'`), `revaluationDate`
(`'YYYY-MM-DD'` or `null`), `warningLevel`, `finalOutcome` (`null` when none), `scenario`,
`qExpected`, `qHappened`, `qWhen`, `qImpact`, `evidenceTypes` (a **JSON string** such as
`'["Call Report","Other"]'`), `evidenceDescription`, `priorWarnings`, `expectations`,
`consequences`, `employeeRole`, `employeeBranch`, `pdf` (base64, no `data:` prefix).

## 4. New file `src/actions/sendDisciplinaryUpdatedEmail.ts` (verbatim)

A copy of the form app's `sendDisciplinaryEmailEN` (same datasource, sender, CC list and
attachment shape). Only the action name and the comment differ; the "UPDATED" subject is
built by the caller.

```ts
import { action } from '@uibakery/data';

// Emails the rebuilt PDF after a Hub edit: To the manager who filed the
// warning, CC Saul, Tim and Marcela. Same datasource, sender and body shape as
// the form app's sendDisciplinaryEmailEN. The caller builds the subject
// ("UPDATED ...") and the HTML with buildUpdatedEmail() in
// app/lib/disciplinaryPdf/strings.ts.
function sendDisciplinaryUpdatedEmail() {
  return action('sendDisciplinaryUpdatedEmail', 'HTTP', {
    datasourceName: 'Email Passiontocare',
    options: {
      method: 'POST',
      url: '/users/no-reply@passiontocarehc.com/sendMail',
      headers: {
        'Content-Type': 'application/json',
      },
      bodyType: 'object',
      body: `{
        message: {
          subject: {{params.subject}},
          importance: "High",
          body: {
            contentType: "HTML",
            content: {{params.htmlBody}},
          },
          from: {
            emailAddress: {
              address: "hello@gafhealthcare.com",
            },
          },
          toRecipients: [
            {
              emailAddress: {
                name: {{params.managerName}},
                address: {{params.managerEmail}},
              },
            },
          ],
          ccRecipients: [
            { emailAddress: { address: "saul.f@vitasyahc.com" } },
            { emailAddress: { address: "tim.m@vitasyahc.com" } },
            { emailAddress: { address: "marcela.g@vitasyahc.com" } },
          ],
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: {{params.attachmentEnName}},
              contentType: "application/pdf",
              contentBytes: {{params.attachmentEnBase64}},
            },
          ],
        },
        saveToSentItems: true,
      }`,
    },
  });
}

export default sendDisciplinaryUpdatedEmail;
```

## 5. `src/actions/updateDisciplinaryActionDeleted.ts`

Two changes. **Who deleted** is now recorded from the login, like `edited_by`, instead of a
name typed in the dialog (prompt 10 removes that box):

```sql
          deleted_by    = {{params.deletedBy}},
```

becomes

```sql
          deleted_by    = lower(btrim({{ user.email }})),
```

Today the WHERE reads:

```sql
      WHERE id = {{params.id}}::bigint
        AND deleted_at IS NULL
      RETURNING id, ref, deleted_at::text AS deleted_at, deleted_by, deletion_note;
```

Add **one line** between `AND deleted_at IS NULL` and `RETURNING`:

```sql
        AND EXISTS (SELECT 1 FROM disciplinary_admins a WHERE a.email = lower(btrim({{ user.email }})))
```

And change the first comment line from
`// Soft-deletes one disciplinary action (super users only, enforced in the UI).` to
`// Soft-deletes one disciplinary action (Tim and Saul only: disciplinary_admins, checked in the database).`
Nothing else changes: `deleted_at = NOW()` and `deletion_note = {{params.note}}` stay as they are.

## 6. `src/actions/updateDisciplinaryActionRestored.ts`

Today the WHERE reads:

```sql
      WHERE id = {{params.id}}::bigint
      RETURNING id, ref;
```

Add **one line** between them:

```sql
        AND EXISTS (SELECT 1 FROM disciplinary_admins a WHERE a.email = lower(btrim({{ user.email }})))
```

Change the first comment line from
`// Restores one soft-deleted disciplinary action by clearing the three deletion`
to `// Restores one soft-deleted disciplinary action (Tim and Saul only) by clearing the three deletion`.
Nothing else changes.

## 7. `src/actions/loadDisciplinaryActions.ts`

In the SELECT list, directly after this existing line:

```sql
             deleted_at::text AS deleted_at, deleted_by, deletion_note,
```

add this one line:

```sql
             edited_at::text AS edited_at, edited_by, (pdf_en_original_base64 IS NOT NULL) AS has_original,
```

Nothing else in this file changes: not the WHERE, not the `translate(...)` strings, not the
ORDER BY. Do **not** add the PDF columns themselves, and do not add any other column.

## Acceptance

Run **only** the two new read actions and the edited loader. **Do not run**
`updateDisciplinaryAction`, `sendDisciplinaryUpdatedEmail`, `updateDisciplinaryActionDeleted`
or `updateDisciplinaryActionRestored`: they change live data or send real email.

1. `git status` would show exactly the 7 files above.
2. `loadDisciplinaryAdmin` run as Saul returns one row, `is_admin = true`.
3. `loadDisciplinaryPdf` with `id` = the smallest id in `disciplinary_actions` that is not
   deleted returns one row. Report only `id`, `ref`, and the **length** of each base64
   column (or `null`), never the base64 itself.
4. `loadDisciplinaryActions` with `{ manager: null, employeeName: null, includeDeleted: false,
   allNames: true, names: '[]' }` returns the same number of rows as before, and each row has
   `edited_at = null`, `edited_by = null`, `has_original = false`.
5. Every `{{ user.email }}` and `{{params.…}}` in the 7 files is outside quotes.

## Report back

1. The 7 file paths, with the size in bytes of each new file.
2. The results of checks 2, 3 and 4 (counts and lengths only).
3. Whether `Email Passiontocare` was accepted as a datasource name for the new HTTP action.

---

## Operator notes (Claude, not UIB)

- Between this prompt and 10, the delete dialog still sends `deletedBy`; the action ignores
  it. Harmless (and the Delete button is not pressed in between).
- `tests/disciplinaryEdit.test.ts` DE4 requires `deleted_by` from `{{ user.email }}`.
- `tests/disciplinaryScope.test.ts` DS4 forbids `pdf_(en|es)_base64` in the loader;
  `pdf_en_original_base64` does not match that pattern, so it passes.
- If Saul connected `Email Passiontocare` to the Hub after the probe, the export's
  `datasources.yml` gains that one line. Expected; not collateral.
- The server-side check of a non-admin (plan, verification 5) is done later from UIB's query
  runner against a test row, not in this prompt.
