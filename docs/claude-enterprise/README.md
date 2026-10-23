# Claude Enterprise kit for the HR Hub

Since 2026-10-22 Saul works from Claude Enterprise: chat only, no Claude Code, no browser control. This folder is everything that loop needs.

| File | For | What |
|---|---|---|
| `00-capability-probe.md` | Record | The test that showed what Enterprise chat can do (results summarised below) |
| `01-SETUP.md` | Saul, once | Create the work folder, the first GOOD zips and the Project, then run the self-check |
| `02-project-instructions.md` | Project Instructions box | Standing rules for every chat |
| `03-HUB-KIT.md` | Project files (Claude) | The full change loop, the prompt template, the UIB facts |
| `04-CHEATSHEET.md` | Saul, every change | One-page flow |
| `05-GITHUB-MIGRATION.md` | Later | Plan for moving to company GitHub + work Claude Code |
| `verify_export.py` | The chat sandbox | Diff baseline vs new export + run all tests. Replaces sync-export + git status + node --test |
| `build_kit.py` | Claude Code | Builds `hr-hub-kit.zip` (this folder + knowledge copies + `hub-harness.zip`) |

## Probe results (2026-10-22, run in Enterprise chat)

| Works | Doesn't |
|---|---|
| Python 3.12 + Node 22.22 sandbox; unzip, hash, diff | Network from the sandbox (no npm install, no fetching URLs) |
| Files persist between messages in one chat | Persistence across chats |
| Downloadable files; reading screenshots | GitHub, M365/OneDrive, Monday, Drive connectors |
| Connectors: gaf-portal-elementor, wordpress-siteground | |
| Project files readable from code at `/mnt/project/`; git installed (self-check, 2026-10-23) | |

Self-check in the real Project (2026-10-23): 957/958 with only L2 red, matching this repo. The test suite needs no npm packages, so the full 958 tests run in the chat sandbox (checked here on 2026-10-23 in a bare workspace: same 957/958 as the repo).

Rebuild the kit after changing tests, tools or a knowledge file: `python3 docs/claude-enterprise/build_kit.py hr-hub-kit.zip`.
