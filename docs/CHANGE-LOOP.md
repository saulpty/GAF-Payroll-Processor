# The UIB change loop

> **Who runs this:** Claude, not Saul. This is the operator runbook for the
> assistant's side of the loop. Saul's side — press Export, paste a prompt,
> report anything that looks wrong — is in [HOW-WE-WORK.md](HOW-WE-WORK.md).
> Every command below assumes the repository root as the working directory.

`src/` is a mirror of the UI Bakery export. It is never hand-edited —
the next sync destroys hand-edits. All application changes go through UIB.

## Per change

1. **Baseline.** `git status` must be clean. If not, sync and commit first.
2. **Design the prompt locally.** Read the real code. Write a prompt that
   names every file that may change, names the functions involved, lists
   what must not be touched, and states acceptance criteria as observable
   outcomes. One coherent change per prompt.
3. **Execute in UIB.**
4. **Export and sync.**
   ```bash
   cd "C:\Users\SaulFallembaum\Documents\GAF-Payroll-Processor"
   node tools/sync-export.mjs "C:/Users/SaulFallembaum/Downloads/GAF HR Hub.zip"
   git status --short
   ```
   Run this from PowerShell — under Git Bash, `tar` fails with EPERM.
5. **Review.** Every file listed must be one you expected. Anything else is
   collateral damage — send it back to UIB as a correction naming the exact
   files to revert.
6. **Test.** `node --test "tests/*.test.ts"`
7. **Load the affected page in the browser.** Mandatory whenever the change
   touched anything in `src/actions/` — see below.
8. **Commit,** with a message naming the change that produced it. Or
   `git checkout -- src/` to discard and retry.
9. **Back up.** `git push`

## Step 7 is not optional for action changes

On 2026-08-11 a change to `loadEmployeeDirectory.ts` produced a clean
two-file diff, passed all 69 tests, respected every do-not-touch
instruction, and was completely broken. `{{params.boardId}}` had been
placed inside a quoted string in the action's body template; UI Bakery
substitutes `{{params.…}}` as a whole value, not as a fragment within a
string, so the placeholder reached Monday.com verbatim and GraphQL returned
`PARSING_ERROR`. Directory Sync returned zero employees.

Nothing in the diff or the test suite could have caught that. The tests do
not exercise UIB actions, and no amount of reading reveals that a template
will not interpolate. **Only loading the page did.**

UIB's own report at the time read *"Everything looks correct. Both files are
fully updated."* Treat a model's self-assessment as a claim to verify, never
as evidence.

**Rule:** if the diff touches `src/actions/`, load the affected page and
confirm real data appears before committing.

### Telling a real failure from a false alarm

Runtime errors in UIB are not all equal:

| Signal | Infrastructure | Your change |
|---|---|---|
| How many actions fail | many, simultaneously | one specific action |
| Message | `too many connections` | a real error from the API or code |
| Survives a reload | no | yes, with a fresh request id |
| Fix | close extra tabs, reload | revert or correct the code |

A fresh `request_id` on each retry proves the failure is deterministic.
Never click UIB's **Fix** button before making this distinction — it will
hunt for a code fault that may not exist and edit working files.

### Reverting

UIB's chat history has **"Revert to this checkpoint"** on each message.
Reverting there restores the builder without touching git. Because commits
only happen after a diff passes, a broken change never enters git in the
first place — after a revert, sync the export and `git status` should come
back clean against the last good commit. On 2026-08-11 it did, exactly.

## Why the git here is simple

One branch, `main`. No pull requests, no merges, no releases — those are
collaboration features and there is one person on this project. The only
remote command in this workflow is `git push` in step 8, and its only job
is keeping an off-machine copy so the project does not live on one laptop.

If `git push` is ever refused, it means the remote has commits the local
repository does not — which cannot happen while one person works from one
machine. Stop and investigate rather than forcing it.

## Prompt rules

Derived from observed failure modes:

- Name every file that may be modified; state no other file may be touched.
- Name functions and components, not just the feature.
- State acceptance criteria as observable outcomes.
- For anything touching times or dates, restate the timezone invariant from
  `src/AGENTS.md` explicitly. This codebase has ~10 migrations that are all
  successive fixes to the same timezone bug.
- One coherent change per prompt. Bundled changes produce unreviewable diffs.

## High-blast-radius files

Changes here affect payroll correctness. Review with extra care:

| File | Size (bytes) |
|---|---|
| `src/app/pages/ProcessPayroll.tsx` | 53,407 |
| `src/app/pages/PayrollMaster.tsx` | 42,934 |
| `src/app/lib/classificationEngine.ts` | 35,657 |
| `src/app/pages/ActionRequired.tsx` | 34,154 |
| `src/app/pages/admin/AdminLookups.tsx` | 30,751 |

`AdminEmployeeSync.tsx` (36,445) used to head this list. It was deleted on
2026-08-18 (`ba5a1f8`), replaced by `admin/employees/*`, and test H5 now asserts
it stays gone.
