# UI Bakery: a reference for Claude

Written for a future Claude session so it doesn't rediscover this. Everything
marked **verified** was tested directly on 2026-08-11 against this instance.
Anything **unverified** is inference or read from UIB's docs — treat it as a
lead, not a fact, and confirm before relying on it.

Instance: `https://uib.vitasya.cloud` (self-hosted, org `vitasya`).
This project: `GAF HR Hub`, app id `jAaT7LYarG`.
`uiBakeryVersion: 3.192.0-rc.0`, `modelVersion: 81`, `fileSystemVersion: 3`,
`internalType: vibe_project`.

---

## What UI Bakery is

A hosted internal-tool builder. It owns the running app, its database, and its
AI editor. It is **the source of truth** — a local git repo can only ever be a
mirror of what it exports.

A "vibe project" is UIB's AI-authored app format: a real React codebase you can
export, not a drag-and-drop canvas.

---

## The export — how code gets out

**verified.** The Export button downloads a `.zip` to the browser's download
folder. Shape:

```
<Project Name>/          ← top-level folder, named after the project
  datasources.yml        ← names of connected datasources
  version.yml            ← projectName, uiBakeryVersion, modelVersion
  src/
    AGENTS.md            ← standing instructions for UIB's AI
    actions/*.ts         ← one server action per file
    app/
      app.tsx            ← routes
      TopNav.tsx
      pages/*.tsx
      lib/*.ts           ← shared logic
      components/*.tsx
      context/*.tsx
    components/ui/*.tsx  ← shadcn-style primitives
    lib/utils.ts
    migrations/*.sql
    migrations/applied.txt
    index.css
    tailwind.config.js
    package.json
    *.md                 ← arbitrary markdown files persist in the project
```

- The zip extracts cleanly with Windows `tar -xf`. No unzip dependency needed.
- Export is **read-only and side-effect free.** Press it freely.
- There is no "import a zip" — code only flows out, never back in. Changes must
  be made inside UIB.

**Gotcha (verified):** under sandboxed Git Bash, `tar` fails with `EPERM`. Run
extraction from PowerShell.

---

## The AI editor

**verified.** A chat panel on the left. Notable features:

- **`src/AGENTS.md` is its standing instruction file.** It reads this before
  every change. On this project it was **0 bytes**, which meant every prompt
  started with no knowledge of the schema, conventions, or invariants. This is
  the highest-leverage thing to fix on any vibe project.
- **"Revert to this checkpoint"** appears next to messages in the chat history.
  UIB keeps per-message checkpoints — an undo that does not involve git.
- **Version badge** (e.g. `v5.5.23`) increments as the AI makes changes.
- **Settings → Tool permissions** controls what the AI may do. Not explored.

**Practical observation:** the visible failure mode on this project was the AI
using a wrong identifier (a Monday.com column ID) and the user correcting it
conversationally, several turns after changes had already been made. Standing
facts belong in `AGENTS.md`, not in per-prompt corrections.

---

## The database

**verified.** Toolbar → Database tab. A table browser, not a query console.

- **No SQL editor was found.** You can browse, filter, sort, add and delete
  rows, and export — but there is no visible "run arbitrary SQL" box. If a task
  needs SQL, either read it out of the grid or have the AI run it.
- **Deep-link a table by URL:**
  `.../builder/summary?uib_table=<table_name>&uib_filters=%5B%5D&uib_sorts=%5B%5D`
  Changing this parameter while the Database tab is already open switches
  tables instantly. Navigating to the URL cold reloads the whole builder
  (slow, ~10s) and lands on Preview — click Database to see the result.
- **The grid renders every row into the DOM, untruncated.** A 46-row table with
  a 522 KB `sql_content` cell was fully present. This makes read-only DOM
  extraction viable and far cheaper than screenshot-scrolling:

  ```js
  const rows = [...document.querySelectorAll('[role="row"]')].slice(1);
  rows.map(r => [...r.querySelectorAll('[role="gridcell"], [role="cell"], td')]
    .map(c => (c.textContent || '').trim()));
  ```

  Column order matches the visible header. Index 0 is the checkbox cell.
- **Bulk-extract without burning context** by building a Blob in the page and
  triggering a download, then reading the file from disk. Ask the user before
  downloading.

### `uib_migrations` — the authoritative migration ledger

**verified.** UIB maintains this table itself. Columns: `id`, `migration_id`,
`name`, `description`, `sql_content`, `checksum`, `applied_at`, `applied_by`,
and an execution-time column.

**`sql_content` holds the full SQL of every applied migration.** This makes the
database self-describing and means lost migration files are recoverable.

**Critical gotcha (verified):** `src/migrations/applied.txt` is **not
reliable**. On this project the database ledger had 46 rows, the repo had 35
`.sql` files, and `applied.txt` listed 14. The likely cause is the project being
cloned/renamed (`Payroll Processor` → `GAF HR Hub`) without the ledger or all
files carrying over. **Always trust `uib_migrations` over `applied.txt`.**

Eleven migrations had run with no file in the project at all — including nine
that defined a view the app depends on. Check for this on any inherited vibe
project: read `uib_migrations`, diff it against `src/migrations/*.sql`.

---

## Git integration — avoid it unless the team needs it

**From UIB's docs** (`docs.uibakery.io/concepts/source-control`), partially
verified:

- Works with any provider over the Git API (GitHub, GitLab, Bitbucket).
- **The target repository must be EMPTY to connect.**
- Connect via SSH URL plus a deploy key with write access.
- **Once connected, `main` is protected and cannot be edited in UIB.** The
  required loop is: pull main → create a branch → change → commit → push →
  open a pull request → get it merged → pull back into UIB.
- **Connecting disables UIB's own release-history restore.** You trade a
  one-click undo for the full branch/PR workflow.
- Stored in git: app settings, pages, components, actions.
  **Not** stored in git: datasources, deployment history, environment
  variables, audit logs. A repo alone cannot reconstitute an instance.

**Verified:** on this instance the connection field was empty — not connected.

**Recommendation:** for a solo non-developer, do not connect. The zip-export →
diff → commit loop gives the same change visibility with none of the ceremony,
and keeps UIB's release-history undo.

---

## Releases and environments

**Partially verified.** Separate from git entirely.

- Edits in the builder are a **draft**. The **Release** button publishes to the
  live app. Staging and production are distinct targets.
- **Settings → Release history** lists previous releases and (while git is
  disconnected) can restore them.
- Per UIB's docs: *"Git commits are separate from app releases."* Deleting the
  branch a version was released from does not change the running app.

Anything not yet Released is invisible to end users. Useful safety property:
mistakes in the builder are not automatically live.

---

## Logs

**verified.** Bottom panel, `Logs (n)`, with counts by severity and a filter
(Verbose / Log / Info / Warn / Error). Each server action logs start, request
payload, and result shape (e.g. `Array[43]`).

Good for confirming which actions a page fires and whether they error. On this
project logs were clean — 0 errors, 0 warnings — while the app still produced
wrong numbers. **Silent logic errors do not appear here.** Do not use a clean
log as evidence of correctness.

---

## Working with UIB through Claude in Chrome

**verified.** The builder is a normal web app.

- Take a screenshot to orient; the toolbar icon positions shift depending on
  which panel is open, so re-screenshot after each panel change rather than
  reusing coordinates.
- `get_page_text` returns nothing useful on the builder (canvas/DOM-heavy).
  Use `read_page`, screenshots, or `javascript_tool`.
- `javascript_tool` with read-only DOM queries is the cheapest way to extract
  tabular data.
- **Never click Release, Delete rows, or any destructive control** without
  explicit user confirmation. Browsing, screenshotting, and reading are safe.

---

## Checklist for an unfamiliar vibe project

1. Export and diff against whatever local copy exists. Assume they disagree.
2. Read `src/AGENTS.md`. If empty, that explains most AI quality problems.
3. Read `uib_migrations` and diff against `src/migrations/*.sql`. Do not trust
   `applied.txt`.
4. List database tables and grep the codebase for each. Tables no code
   references are abandoned features or undocumented schema.
5. Check whether git is connected (Settings → GitHub connection).
6. Check file sizes in `src/app/pages/`. Anything over ~25 KB is where AI edits
   will start damaging unrelated code.
7. Open Logs, then ignore a clean result — it proves nothing about correctness.

---

## Open questions

Things not established, worth resolving when they next matter:

- Is there any way to run arbitrary SQL from the UI? Only the table browser was
  found.
- Can `AGENTS.md` be edited directly in the builder's file view, or only via
  the AI chat?
- What exactly does Settings → Tool permissions control?
- Does UIB expose an API for exports, so the sync loop could be automated
  without clicking Export?
- Can a release be rolled back from the UI while git is disconnected, and how
  far back does release history reach?

---

## The two URLs the loop needs (verified 2026-09-01)

These were never written down and had to be rediscovered. They are stable.

| Tab | URL |
|---|---|
| **Work** — AI panel, the one builder session | `https://uib.vitasya.cloud/edit/vitasya/jAaT7LYarG/builder/summary` |
| **Export / verify** — draft app, safe for the ⋮ menu | `https://uib.vitasya.cloud/dev/vitasya/jAaT7LYarG/<route>` |

`/dev/`, `/staging/` and plain `/vitasya/…` (prod) are the three environments.
**Builder edits are drafts: they appear on `/dev/` immediately and reach prod
only when someone clicks Release.** So verify on `/dev/`, never on prod.

The ⋮ → Export menu lives in the left app sidebar and is present on the app
view, so the export tab never needs to load `/edit/…` — which is exactly the
rule that keeps the second-editor-session trap shut.

### The app renders inside an iframe

On `/dev/…` the app is inside `<iframe src=".../workbench">`. `document.querySelector`
in the top frame finds **nothing** — it returned 0 rows on a page showing 44.
Reach in explicitly, same origin so it is allowed:

```js
const d = document.querySelector('iframe').contentDocument;
d.querySelectorAll('tbody tr').length;
```

### Driving the AI panel

Verified working, repeatedly, on 2026-09-01:

- The panel is **Angular** (`ng-tns-*` classes), not React. The textarea is the
  one with placeholder `Ask UI Bakery...`; the send button is
  `button.submit-message`.
- Focus the textarea via JS, paste with `ctrl+v`, then **check
  `.value.length` against the file's character count before submitting.** Set
  the clipboard with
  `[System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) | Set-Clipboard`
  — six prompts went in this way with no mojibake and no coordinate drift.
- Do not trust the placeholder alone as a done-signal: it flips back to
  `Ask UI Bakery...` briefly *mid-run* while tool calls execute.
- Results tables render as real `<table>` elements, so read them structurally
  rather than screenshot-scrolling. Reading the panel's whole `innerText` can
  trip a content filter; per-table extraction does not.
