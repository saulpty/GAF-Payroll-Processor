# Phase 2: moving to company GitHub (planned, not started)

**When to use this:** Saul gets (a) a GitHub organisation owned by the company and (b) work Claude Code, even a limited one without Chrome. Then UIB can push each app to GitHub and Claude Code can review the changes there. The personal `saulpty/*` repos close.

The chat kit stays valid until then. The loop steps don't change, only *how* steps 3-4 are done:

| Loop step | Chat kit (today) | After the move |
|---|---|---|
| 3 Export | Saul exports a zip and attaches it | UIB commits to a branch and pushes |
| 4 Diff + tests | `verify_export.py` in the chat sandbox | Claude Code: `git diff` on the branch + `node --test "tests/*.test.ts"` |
| 6 Keep or undo | The zip goes into `GOOD\` | Merge the PR / close it |

## Steps, in order

| # | Step | Why / blind spot |
|---|---|---|
| 1 | **Test on a throwaway UIB app first.** Create a small copy app, connect it, make one change, push, merge, pull back | Connecting is hard to undo, and we haven't verified how UIB behaves after connecting |
| 2 | Check what's lost: UIB's docs say connecting **disables release-history restore** while git is connected. Check in the test app whether the per-message "Revert to this checkpoint" still works | Losing one-click undo on the payroll app is the biggest risk |
| 3 | Check whether UIB tolerates extra folders (`tests/`, `docs/`, `tools/`) in the repo it pushes to, or overwrites them on push | Decides one repo vs two. If UIB overwrites them: a sibling `gaf-hr-hub-ops` repo for tests/docs/tools |
| 4 | Create **empty** company repos: one per UIB app (Hub, Disciplinary Form), plus `-ops` if step 3 says so | UIB requires the target repo to be empty, so the existing history can't be the target |
| 5 | Archive the personal repos into the company org as **read-only history** (transfer or mirror) | Keeps 2+ months of prompts, findings and lessons, and gets company payroll code out of a personal account |
| 6 | Connect the Hub and the Form in UIB (SSH URL + deploy key with write access) | From UIB's docs. Not done on this instance yet |
| 7 | Learn the new UIB flow: `main` is locked in the builder. Each change: pull main → branch → prompt → commit → push → PR → merge → pull back into UIB | More clicks for Saul per change. Worth it only if Claude Code reviews each PR |
| 8 | Update the repo's `CLAUDE.md` / `CHANGE-LOOP.md` for the git flow and retire this kit | One source of truth again |

## Questions to answer during step 1

- Does UIB push the whole project or only changed files? Does it include `datasources.yml` / `version.yml`?
- Can a UIB release still be rolled back from Settings → Release history after connecting?
- Do commit messages carry the AI prompt, or something generic?
- Who can approve PRs? A single-person org may need branch protection relaxed.

## Cost-benefit

| | Chat kit | Company GitHub + Claude Code |
|---|---|---|
| Clicks per change for Saul | ~6 (paste, export, attach, screenshot, rename, move) | ~6-8 in UIB's git flow, but no zips |
| Diff and test quality | Same tests, same checks | Same, plus real history, blame and PR review |
| Risk | Folder discipline (GOOD\ must stay clean) | Loses UIB release-history restore (verify in step 2) |
| Compliance | Work data on the work laptop | Best: everything in company accounts |
