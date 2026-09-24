# 01 (F0) — Write this app's `src/AGENTS.md`

> **⚠ This prompt goes into the 'GAF Disciplinary Actions Form' app (PC3PsXDDa9), NOT the GAF Panama HR Hub. Check the project name in the builder before pasting.**

**Inside this project the code root *is* `src`, so `src/app/…` means `app/…`.**

**Only this one file may change. No other file may be touched.**

- `src/AGENTS.md` — it is empty today. Replace its content with the text below, character for character.

Do not edit any action, page, component, hook, util or migration. Do not run any action.

## Why

This app has no written rules, so every change starts from zero. The next five prompts change
who may file a warning and for whom. This file records the facts they depend on, so later
edits keep them.

## `src/AGENTS.md` — the entire content

````markdown
# GAF Disciplinary Actions Form — standing facts

## What this app is
A 4-step wizard (`app/pages/OfferLetterForm.tsx` — the name is historical, it is the
disciplinary form) that a manager uses to file a disciplinary action for one of their
employees. On submit it builds an EN PDF in the browser, INSERTs one row into
`disciplinary_actions`, and emails the PDF.

A second app, the **GAF Panama HR Hub**, reads the same table. **The Hub edits,
closes, deletes and restores rows. This app only creates them.** Never add an UPDATE
or DELETE on `disciplinary_actions` to this app's actions.

## Datasources (use these exact names)
- `SAUL Disciplinary Action Forms DB` — Postgres. Tables `disciplinary_actions`,
  `disciplinary_admins`.
- `Monday.com API` — HTTP (GraphQL).
- `Email Passiontocare` — HTTP (Microsoft Graph sendMail).

## Who is filing: always the logged-in user
- The filer is **always** the signed-in UI Bakery user, `{{ user.email }}`. UI Bakery
  fills it in on the server; the browser cannot choose it. Write it as
  `lower(btrim({{ user.email }}::text))`.
- The filer's email is **never typed** into the form and never taken from a param.
  `saveSubmission` writes `manager_email` from `{{ user.email }}`.
- `loadCurrentFiler` returns `email`, `is_admin`, `admin_name` for the signed-in user.

## Who the filer may file for
- `disciplinary_admins (email TEXT PRIMARY KEY, name TEXT NOT NULL)` — people who see
  **every** current employee (Saul Fallembaum, Timothy Moore). Emails stored lower-case,
  trimmed.
- Everyone else sees only the employees who list them in any of the four manager slots
  on the Monday directory (compared by email, case-insensitive).
- The rule lives in `app/utils/filerScope.ts` (`employeesForFiler`). It is a pure
  function with no React and no imports; the Hub's git repo unit-tests it by file path.
  Do not rename it, move it, or add imports to it.
- There is **no hardcoded employee list** anywhere. If Monday fails, the form says so;
  it never falls back to a built-in list.

## Monday
- **Panama Employee Directory**, board `8592460836`. An employee is current **only** if
  their row is in the *Current Employees* group, id `topics`. Not the Status column.
- Manager slots (name column / email column):
  - Manager 1: `text_mkzj84w1` / `text_mkzj8b73`
  - Manager 2: `text_mm785e8r` / `text_mm15y2vw`
  - Manager 3: `text_mm786kge` / `text_mm78fxpg`
  - Manager 4: `text_mm78whj1` / `text_mm78hgkr`
- Other directory columns: `lookup_mkpteyp5` job title, `color_mkpt5gk4` branch,
  `color_mkyjv6et` status.
- **Onboarding board** `8661565945` is used **only** for the job title (column `text`).
  Never use it for managers or for who is current.

## `disciplinary_actions` columns this app must respect
- Soft delete: `deleted_at`, `deleted_by`, `deletion_note`. `deleted_at` NULL = live.
  `getPriorActions` must keep `AND deleted_at IS NULL`.
- Closure: `closed_at`, `closed_by`, `closure_note` — set by the Hub only.
- Edit history: `edited_at`, `edited_by`, `pdf_en_original_base64` — set by the Hub only.

## Email
`sendDisciplinaryEmailEN` sends **to the filer** (the logged-in user) and CCs
saul.f@vitasyahc.com, tim.m@vitasyahc.com, marcela.g@vitasyahc.com.

## Rules for every change
- `{{params.x}}` is substituted whole. **Never put it inside a quoted string** in SQL
  or in an HTTP body. Cast it instead: `{{params.x}}::date`, `{{params.ids}}::jsonb`.
- `useLoadAction(action, default, { a, b })` — params go **flat** in the third
  argument. **Never** `{ params: { … } }`: every `{{params.x}}` would be undefined and
  the query silently returns nothing.
- One action per file under `actions/`.
- **Every file under 15 KB.** Split a component rather than let it grow.
  (`app/utils/generatePdf.ts` is 19.9 KB — split it the next time it is touched.)
- **Never edit anything under `components/ui/`.**
- Dates are `YYYY-MM-DD` strings in **local** time. Build "today" from
  `getFullYear()/getMonth()/getDate()`, never `toISOString()` (after 7 pm in Panama
  that is tomorrow's date).
- Migrations: show the SQL and wait for a human to read it before Execute. Only
  additive changes unless a prompt says otherwise.
````

## Acceptance

1. `src/AGENTS.md` contains exactly the text above.
2. No other file changed.

## Report back

List every file you created, changed or deleted (it should be only `src/AGENTS.md`).
