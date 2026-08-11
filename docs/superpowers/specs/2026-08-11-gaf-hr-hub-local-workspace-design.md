# GAF HR Hub — Local Workspace & UIB Change Loop

**Date:** 2026-08-11
**Status:** Approved
**Scope:** Project A — workspace and working loop only. Application fixes and features (Project B) are out of scope and each get their own design → plan → build cycle on top of this foundation.

---

## Context

The app is a UI Bakery "vibe project" (`uiBakeryVersion: 3.192.0-rc.0`, `modelVersion: 81`), renamed from *Payroll Processor* to *GAF HR Hub*. It is a payroll and attendance system for GAF Healthcare staff: React 19, react-router v6, Tailwind, shadcn-style components, `@uibakery/data` server actions. Three connected datasources: **GAF Planilla DB** (primary, Postgres, UIB-hosted), **Monday.com API**, **Monday.com API v2**.

Development has moved fully local. GitHub is no longer used. UI Bakery remains the only place the app is edited and run; the local repository is a mirror used for reading, diffing, designing, and testing.

### Reported problems

1. UIB edits break unrelated parts of the app.
2. Wrong numbers — payroll totals, tardiness classification, discounts, attendance figures.
3. Timezone and date bugs.
4. Migrations and DB out of sync.
5. A backlog of features blocked by fear of regression.
6. UX that is not intuitive.

Items 1 and 5 are workspace problems and are addressed here. Items 2, 3, 4, and 6 are application problems addressed in Project B — but this design removes the conditions that make them hard to diagnose.

---

## Findings from the 2026-08-11 export review

Evidence gathered by extracting `Downloads\GAF HR Hub.zip` (142 files) and diffing against the local repository.

**The export is strictly ahead of local.** Ignoring CRLF/LF noise, 32 files have real content changes, 13 files are new (`app/FilterBar.tsx`, `app/context/GlobalFilterContext.tsx`, `softDeletePayrollEntry`, `restorePayrollEntry`, `loadDeletedEntries`, `renamePeriod`, `loadActionRequiredCounts`, and others), and 9 migrations are new. Local retains two files the export intentionally deleted (`AdminGraceList.tsx`, `AdminMacbookSwap.tsx`). The local repository's last meaningful sync was approximately 2026-06-22.

**`src/AGENTS.md` is 0 bytes.** This is the file UI Bakery supplies to its agent as standing project instructions. It is empty, so every prompt begins with no context about the schema, the timezone rules, the classification model, or project conventions. This is the most probable single cause of poor edit quality and the cheapest to fix.

**The migration ledger is inconsistent.** The export's `applied.txt` records migrations through `1781275100_import_excel_operator_resolved` (2026-06-12), then jumps to `1781803200_fix_directory_sync_emails_and_duplicates` (2026-08-07). Roughly twenty migrations between those points — including `1781400000_us_eastern_schedules`, the `entry_time` format fixes, `1781401000_create_hrk_exports_table`, and `1781402100_add_soft_delete_to_payroll_entries` — exist as `.sql` files with no applied record. The local `applied.txt` *does* record them through `1781401400`. The two ledgers disagree, and at least one disagrees with the live database.

**Undocumented schema.** The database contains `pto_approvals`, `pto_employees`, and `pto_floating_holidays`. No migration in the export creates them, and no action or page references them. There is live schema the codebase has no knowledge of.

**Oversized files.** `ProcessPayroll.tsx` (53 KB), `PayrollMaster.tsx` (43 KB), `AdminEmployeeSync.tsx` (36 KB), `classificationEngine.ts` (35 KB), `ActionRequired.tsx` (34 KB), `AdminLookups.tsx` (30 KB). Files at this size are where in-editor AI edits become unreliable, regardless of model.

**Timezone churn.** Roughly ten migrations are successive corrections to the same Panama-vs-US-Eastern problem (`1781400000`, `1781400100`, `1781400500`–`700`, `1781401100`–`1400`, `1781401900`). This history is undocumented, so each new agent session is free to reintroduce the same mistake.

---

## Goals

- A single, unambiguous local location for the app.
- Every UIB change produces a reviewable diff before it is trusted.
- Standing instructions that survive across UIB prompting sessions.
- A schema and migration state that matches reality.
- No dependency on GitHub.

## Non-goals

- Running the app locally. UI Bakery hosts and runs it; local is a mirror.
- Editing `src/` by hand.
- Refactoring the oversized files (deferred — see Deferred Work).
- Any Project B fix or feature.

---

## Section 1 — Workspace layout

```
C:\Users\SaulFallembaum\Documents\GAF-HR-Hub\
  src\        verbatim mirror of the UIB export — never hand-edited
  docs\       specs, findings, decisions
  tests\      existing test files, expanded over time
  tools\      the export sync tool
  exports\    archived raw .zip of each export, timestamped (gitignored)
  .claude\    skills, settings
```

Renamed from `GAF-Payroll-Processor` to match the UIB project name.

**`src/` is a mirror, not a workspace.** Hand-edits there are silently destroyed by the next export. This rule is the difference between a useful diff and a meaningless one, and it is non-negotiable for the loop in Section 2 to work.

**Git is retained. GitHub is retained as a backup only.** *(Revised 2026-08-11 — originally "GitHub is not retained".)*

The initial decision to drop GitHub rested on a misunderstanding: the user's difficulty was with branches, pull requests, merges, and releases — git *ceremony* — not with remote storage. The branch consolidation below removes all of that ceremony. With a single branch and no collaborators, there is nothing to merge, no pull request to open, and no release to cut.

The `origin` remote is therefore kept, used for one purpose: an off-machine copy. Without it the entire history of a production payroll system exists on a single laptop. `git push` is the only remote command in the workflow. This also preserves the option of UI Bakery's native "Connect Git" integration, which could automate the export loop entirely and requires a remote to target.

Branch handling, based on measured divergence:

- `fix/discount-and-monday-alias` holds the real history — `main` is 0 ahead, 17 behind. `main` fast-forwards to it, then the branch is deleted. `main` becomes the single working branch.
- `staging` is genuinely divergent: 15 commits not present elsewhere, against 14 the other way. It is **not** deleted. It is preserved as tag `archive/staging` before removal, so the work remains recoverable.
- `claude/gaf-hr-hub-local-92331a` and `claude/wizardly-curran-2e1f19` both point at the repository root commit (`f8f6a24`) and contain nothing unique. They are deleted along with their worktrees under `.claude\worktrees\`.

The 2026-08-11 export supersedes all of this code regardless; the history is retained for archival value only, which is why archiving is preferred over deletion wherever the cost is a tag.

Each export becomes exactly one commit, with a message naming the change that produced it. `git diff` between two commits therefore answers "what did that UIB prompt actually change?" — including changes that were not asked for.

### Mirror semantics

Syncing an export into `src/` is an **exact mirror**, not a merge: files added in the export are added, files changed are overwritten, and **files absent from the export are deleted locally**. Without the deletion half, files UIB has intentionally removed — such as `AdminGraceList.tsx` and `AdminMacbookSwap.tsx` — linger locally and every future diff carries phantom entries.

Line endings are normalized so CRLF-vs-LF differences never appear in a diff. In the 2026-08-11 export, 142 files reported as changed but only 32 had real content changes; that noise ratio makes review impossible and must be eliminated for the loop to function.

### Sequencing constraint

The active Claude Code session runs inside `.claude\worktrees\gaf-hr-hub-local-92331a`, beneath the directory being renamed. Windows will not rename a directory that a running process has open. The rename must therefore be the final step, and the session may need to be restarted in the new path afterward.

---

## Section 2 — The change loop

Every change follows this sequence:

1. **Export and snapshot.** Export from UIB, unzip, sync into `src/`, archive the raw zip to `exports/`, diff against the previous commit, commit. Establishes a known-good baseline.
2. **Design locally.** Read the actual code and write the change as a scoped prompt: exact file paths, exact function names, an explicit do-not-touch list, and acceptance criteria.
3. **Execute in UIB.** Either driven through Claude in Chrome, or handed over as a prompt to paste.
4. **Export and diff.** Re-export and diff. If a Period Log change shows edits to `classificationEngine.ts`, that is caught here — before it reaches payroll.
5. **Commit or revert.** A clean diff is committed. A dirty diff yields an exact list of collateral damage to send back to UIB as a correction prompt.

Step 4 does not prevent unwanted edits. It makes them visible within seconds instead of weeks, which is what converts an unsafe change into a recoverable one.

### Prompt construction rules

Scoped prompts, derived from the failure modes above:

- Name every file that may be modified. State that no other file may be touched.
- Name the functions or components involved, not just the feature.
- State acceptance criteria as observable outcomes.
- For anything touching times or dates, restate the timezone invariant explicitly (see `AGENTS.md`).
- Request one coherent change per prompt. Bundled changes produce diffs too large to review.

---

## Section 3 — Prerequisites

Both must be complete before Project B work begins.

### 3.1 — Write `src/AGENTS.md`

Authored locally, then transferred into UIB so its agent receives it as standing context. Contents:

- **Schema reference.** Every table, its purpose, and its relationships.
- **Timezone rules.** The US-Eastern-native model, what the Panama-era data looked like, which migrations converted it, and the invariant that must never be violated. This section exists specifically to stop the recurring reintroduction of this bug.
- **Classification model.** How event types, rules, pay impacts, and `classification_config` interact.
- **File map.** What each page and action is responsible for.
- **Hard constraints.** Explicit "never do this" rules, including which files are high-blast-radius.

`AGENTS.md` is exported by UIB, so it is version-controlled like any other file and improves over time.

### 3.2 — Reconcile migrations and schema

- Determine the true applied state from the `uib_migrations` table, via SQL run in the UIB Database tab.
- Reconcile against both `applied.txt` ledgers; document the discrepancy and its cause.
- Identify the origin of `pto_approvals`, `pto_employees`, and `pto_floating_holidays` — whether abandoned work, a manual change, or a feature under construction. Either document them or produce a migration that reflects them.
- Record the reconciled truth in `docs/`.

Until this is done, "migrations out of sync" recurs and the schema cannot be trusted when diagnosing incorrect numbers.

---

## Data handling

The database holds employment records for GAF Healthcare staff — payroll, attendance, schedules, tardiness.

HIPAA's definition of protected health information excludes employment records held by a covered entity in its role as employer, so this data is likely outside HIPAA's scope. **This should be confirmed by the tech team rather than assumed.** Conservative handling applies regardless:

- Requests are for schema, DDL, row counts, and aggregates — not employee-level rows.
- Specific records are referenced by row `id`; names may be masked.
- No database contents leave the local machine: no artifacts, no web requests, no query results committed with real values. Findings are recorded in `docs/` with values redacted.
- Database questions are batched into single copy-paste SQL blocks for the UIB Database tab.

---

## Deferred work

**Splitting the oversized files.** The correct long-term fix for unreliable edits, but refactoring a 53 KB file *through* UIB is itself the highest-risk operation available. Each file is split immediately before substantial work begins in it, with the diff net already established. Not done preemptively.

---

## Risks

| Risk | Mitigation |
|---|---|
| Hand-edits to `src/` are lost on next export | Documented rule; all changes routed through UIB |
| Rename fails due to open file handles | Rename sequenced last; session restarted in new path |
| Export omits UIB state not represented as files | Exports archived raw in `exports/`; UIB remains source of truth |
| Migration reconciliation reveals genuine drift needing DB writes | Findings documented and reviewed before any write is proposed |
| Backup goes stale because pushing is a manual step | `git push` added to the change loop; UIB "Connect Git" evaluated as an automatic alternative |
| Git ceremony (branches, PRs, merges) reappears and causes confusion again | Single-branch model with no collaborators makes it structurally impossible — there is nothing to branch from or merge into |

---

## Success criteria

1. One folder, `Documents\GAF-HR-Hub\`, containing the current app; `main` the only branch, `origin` retained as a backup remote, no leftover worktrees, `staging` preserved as tag `archive/staging`.
2. `src/` matches the 2026-08-11 export exactly and is committed.
3. A UIB change can be exported, diffed, and committed, and the diff correctly identifies files changed outside the requested scope.
4. `src/AGENTS.md` is non-empty, present in UIB, and covers schema, timezone rules, classification, file map, and hard constraints.
5. The true applied-migration state is documented, and the `pto_*` tables are explained.
6. Project B work can begin against a known-good baseline.
