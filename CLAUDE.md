# GAF HR Hub — read this before doing anything

This file loads automatically at the start of every session. It exists because a
session once started work without knowing the loop and nearly hand-edited `src/`.

**Saul is not a coder.** Explain in plain language. Never assume he'll read code
to understand what you did.

---

## The one rule that matters most

**`src/` is a read-only mirror. Never hand-edit it.**

UI Bakery (UIB) is the only place the app runs and the only place it gets
edited. This repo is a photocopy, used to answer one question: *what exactly
changed?* Any edit you make to `src/` is destroyed by the next export and never
reaches the live app.

Hand-written files are limited to `tests/`, `tools/`, `docs/`, and this file.

---

## The change loop — every app change, no exceptions

Full version in `docs/CHANGE-LOOP.md`. The short form:

1. **Write the prompt to a file first** under
   `docs/superpowers/prompts/<YYYY-MM-DD>-<topic>/NN-<slug>.md`, and commit it.
   The prompt names exactly which files may change and says *no other file may
   be touched*.
2. **Paste it into UIB's AI panel** (the builder tab). Copy via
   `Set-Clipboard`, then **screenshot the textarea before submitting** — the
   clipboard gets clobbered, and one paste once arrived as `\O2W-lqEa0-uBnN3`.
3. **Wait.** Done = the textarea placeholder stops reading
   `Working on your request...`. Confirm the panel's last message is *your*
   prompt's summary, not the previous one — a mis-aimed submit click is common.
4. **Export** from UIB: the ⋮ menu next to *GAF HR Hub* → screenshot → *then*
   click Export. Clicking straight through often just closes the menu.
5. **Sync** (PowerShell, because the Bash tool can't spawn `tar`):
   ```
   node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub (N).zip"
   ```
   Always take the newest zip; the name increments. If it reports
   `added: 0, changed: 0`, **check Downloads for a new zip before concluding
   anything** — the export click often just closes the menu, and 0/0 then means
   the export never happened, not that the prompt changed nothing.
6. **`git status --short`** must show only the files the prompt allowed.
   Anything else is collateral: revert in UIB, re-export, re-prompt.
7. **`node --test "tests/*.test.ts"`** — all pass. Baseline is 100.
8. **Load the page in the browser and look at it.** Mandatory for any change
   touching `src/actions/` or a page. TypeScript-clean is not the same as runs.
9. **Commit**, with a message that says what changed and what was verified.
10. At the end of a piece of work: `git merge --ff-only` into `main` from the
    main checkout, then push.

**Never press UIB's "Fix" button** on a runtime error. Read the console,
diagnose, write a targeted prompt. "Ignore" is safe — it only dismisses the
banner.

---

## Where to look for what

| File | What it holds |
|---|---|
| `docs/HANDOFF-<latest date>.md` | **Start here.** What's live, what's waiting on a human, roadmap state. |
| `docs/LESSONS.md` | Traps that have actually cost time here. Several have bitten twice. Read before touching PTO or the Directory sync. |
| `docs/CHANGE-LOOP.md` | The loop above, in full, plus the six high-blast-radius files. |
| `docs/HOW-WE-WORK.md` | Plain-language guide written for Saul — the three places the app lives. |
| `docs/BACKLOG.md` | Feature roadmap (A–G) and known issues, ranked by payroll risk. |
| `src/AGENTS.md` | Technical rules: schema, timezone invariant, Monday integration, file map, hard constraints. |
| `docs/superpowers/prompts/` | Every prompt ever sent to UIB, verbatim. |
| `docs/superpowers/specs/`, `plans/` | Designs and implementation plans. |
| `docs/findings/` | Investigations, with the evidence that produced each conclusion. |

---

## Non-negotiables

- **Payroll is untouchable** unless Saul explicitly asks. Never edit
  `ProcessPayroll.tsx`, `PayrollMaster.tsx`, `ActionRequired.tsx`,
  `classificationEngine.ts`, `AdminLookups.tsx`, `teramindParser.ts`, or
  anything under `src/components/ui/`.
- **Never hardcode a Monday board, column or group id.** They live in
  `classification_config`. H4 fails the build if one appears in the admin,
  Employees or PTO code — but **its file list has never included
  `ProcessPayroll.tsx`**, which still holds 14 as `cfgGet(key, '<literal>')`
  fallbacks. L4 in `tests/lessonGuards.test.ts` ratchets that count so it cannot
  grow, and since 2026-08-26 the page shows a red banner naming any config key it
  had to fall back on.
- **Timezone invariant.** Dates are `YYYY-MM-DD` strings. Compare them as
  strings. Never `new Date(str)` for date math. "Today" is
  `toLocalYMD(new Date())` from `classificationEngine`, never
  `toISOString().slice(0,10)`. Postgres hands back full timestamps — slice to 10.
- **`{{params.x}}` is substituted whole.** Never place it inside a quoted string
  in an action body.
- **Files stay under 15 KB.** Split a component rather than let one grow.
- **One action per file**, named `load*` / `upsert*` / `update*` / `delete*`.
  Every new `load*` takes an optional `manager` param so manager-scoped access
  stays a wiring job later.

---

## Two bugs that have each bitten twice — check for them by name

**1. The params-wrapper.** `useLoadAction(action, default, { params: {...} })`
is wrong; parameters go **flat**: `useLoadAction(action, default, {...})`. With
the wrapper, every `{{params.x}}` is undefined and the query silently returns
nothing or partial data — no error. It once left WFH, Birthday and FH-used
reading 0 for all 45 employees while the other columns looked perfect.
**When you find one, grep every call site in the feature before moving on.**

**2. Current vs Past employees.** An employee is active **if and only if** their
row is in the *Current Employees* group on the Panama Employee Directory board.
Not the Status column — a new row can have a blank status. Before touching
anything that reads that board, ask whether the path filters by
`monday_group_directory_current`.

---

## How Saul works

- He'll often be right when he pushes back. Check the data before defending a
  conclusion, and say plainly when you were wrong.
- Verify before asserting. Don't say "fixed" or "it's set" without running the
  query or loading the page — and beware the UIB query runner showing a *stale*
  result from the previous run.
- Distinguish a transient infrastructure blip (works on retry, usually
  connection pressure) from a real defect (deterministic, reproduces on reload).
- Screenshots of the app are the evidence he trusts. Take them.

---

## Session start checklist

1. `git log --oneline -5` and `git status --short` — know where you are.
2. Read the newest `docs/HANDOFF-*.md`.
3. Skim `docs/LESSONS.md`.
4. Ask Saul what he wants to work on before touching anything.
