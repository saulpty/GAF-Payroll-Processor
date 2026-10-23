# HR Hub kit: how Claude works on the Hub from Enterprise chat

The runbook for Claude. It replaces `CHANGE-LOOP.md` and the Chrome parts of `UIB-GUIDE-FOR-CLAUDE.md` for as long as the work happens in chat only (since 2026-10-22). Saul's side is in `04-CHEATSHEET.md`.

The steps are named by **what they prove**, not by the tool, so that when work moves to company GitHub (`05-GITHUB-MIGRATION.md`) only the "how" column changes.

---

## 1. Who does what

| Step | Proves | Who | How (chat-only, today) |
|---|---|---|---|
| 0 Baseline | We start from a known, healthy app | Claude | `verify_export.py` on the newest GOOD export |
| 1 Prompt | The change is specific and checkable | Claude | Read the real code in the sandbox, write the prompt |
| 2 Execute | UIB made the change | Saul | Paste into UIB's AI panel, wait, paste UIB's file list back |
| 3 Export | We have a photocopy of the result | Saul | Tab 2 (`/dev`) ⋮ menu → Export, attach the zip |
| 4 Diff + tests | Only the allowed files changed and nothing broke | Claude | `verify_export.py --base GOOD --new NEW --allow ...` |
| 5 Look | It works on screen with real data | Saul + Claude | Ctrl+Shift+R on `/dev`, screenshot, Claude checks it against the criteria |
| 6 Keep or undo | History stays clean | Saul | PASS: the zip goes to `GOOD\`. FAIL: "Revert to this checkpoint" in UIB |
| 7 Record | The next chat knows what happened | Claude → Saul | Handoff + prompt files, which Saul saves to the folder and the Project |

Step 5 is mandatory whenever `src/actions/` or a page changed. On 2026-08-11 a change passed its diff and all tests and was completely broken (`{{params.boardId}}` inside quotes). Only loading the page caught it.

---

## 2. Start of every chat

Saul attaches (from `HR Hub\GOOD\` and `HR Hub\kit\`). Project files are already on disk at `/mnt/project/` (checked 2026-10-23), so the script never needs attaching:

| File | Why |
|---|---|
| Newest `… hub.zip` from GOOD | The current app: what you read and diff against |
| Newest `… form.zip` from GOOD | The Disciplinary Form app. The tests read both apps |
| `hub-harness.zip` | `tests/`, `tools/`, `.gitattributes`, `.gitignore`, and the one doc a test reads. Only if it isn't already at `/mnt/project/hub-harness.zip` |

Then you:

1. Gather everything in one work folder: `mkdir -p ~/w && cp /mnt/user-data/uploads/* /mnt/project/verify_export.py ~/w/` (plus `/mnt/project/hub-harness.zip` if it's there). The sandbox has git, node 22 and python3.
2. Run the baseline:
   `python3 -I verify_export.py --harness hub-harness.zip --new "<GOOD hub>.zip" --other "<GOOD form>.zip" --out base`
   Expected: 957/958 pass, the one red is **L2** (`loadEmployeeCalendar.ts` quoting `{{params.email/start/end}}`, known since 2026-10-20). Anything else red: tell Saul before starting new work.
3. Unzip the GOOD hub into `~/w/hub/` so you can read and grep the real code.
4. Read the newest `HANDOFF-*.md` in Project files, then ask Saul what to work on. Don't start on your own.

---

## 3. Writing the UIB prompt (step 1)

Read the code first: grep the files, open them, find the functions. A prompt written from memory is how wrong ids and invented functions get in.

Template:

````markdown
## <one-line goal>

Context: <2-4 lines, what's wrong / what's wanted, in UIB's terms>

Files you may change:
- src/app/pages/PtoTracker.tsx
- src/actions/loadPtoBalances.ts

No other file may be created, changed or deleted. If you think another file must change, stop and say which and why instead of changing it.

What to do:
1. <specific, by function / component name>
2. ...

Rules that apply here: <restate the relevant invariant, e.g. the timezone rule, params-flat, viewer scoping>

Done when (Saul will check these on /dev):
- <observable outcome, e.g. "PTO shows 44 employees for a super user, 13 in View As Arelis">
- ...

When finished, list every file you created, changed or deleted, one per line.

END OF PROMPT
````

- One coherent change per prompt. Bundled changes produce unreviewable diffs.
- For dates or times, restate the timezone invariant in full. About 10 migrations were successive fixes to the same timezone bug.
- Give the prompt as a code block and as a downloadable file named `NN-<slug>.md`, saved by Saul under `HR Hub\prompts\<YYYY-MM-DD>-<topic>\`.
- Keep the `--allow` list for step 4 identical to "Files you may change". Write it down in the chat.

---

## 4. Checking the export (step 4)

```
python3 -I verify_export.py --harness hub-harness.zip \
  --base "<GOOD hub>.zip" --new "<new export>.zip" --other "<GOOD form>.zip" \
  --allow src/app/pages/PtoTracker.tsx --allow src/actions/loadPtoBalances.ts --out check
```

For a Form-app change, swap the roles: `--base` and `--new` are Form zips, `--other` is the GOOD hub.

What it checks: same app (it refuses a Hub-vs-Form diff), the added/changed/removed files, collateral (outside `--allow`), payroll/ui files touched, the 15 KB cap on touched files, and the full test suite on the baseline and the new export. Only failures that are **new** count against the change.

After the script:
- Read the diff of every changed file (`diff -u`) yourself. The script proves *which* files changed; you check *how*. Look for the three recurring bugs by name.
- Compare UIB's own file list (Saul pastes it) with the script's. A mismatch is worth a sentence.
- Present the result to Saul as the script's table plus 1-3 plain lines. Create `check/verify-report.md` as a download if he wants to keep it.

**`added: 0, changed: 0`?** First ask whether the Export click actually produced a new zip (it often only closes the menu). Compare the zip's file name and time with the previous one before concluding UIB did nothing.

### When a test fails because the change was intended

Some tests pin file hashes or exact text from earlier prompts (e.g. "MP3: the files this prompt only uses are byte for byte what they were"). A legitimate change can trip them. Then:
1. Show Saul which test, what it guards, and why this change is allowed to move it.
2. Edit the test in `~/w/harness/tests/` and re-run until green.
3. Hand back a new `hub-harness.zip` for `HR Hub\kit\` (and Project files, if it's stored there).

Never weaken or delete a test just to get green. If unsure, the test is right.

---

## 5. Looking at it (step 5)

Ask Saul for: a hard refresh (Ctrl+Shift+R) on `/dev/vitasya/jAaT7LYarG/<route>`, then a screenshot of the page. For scoped data, also one in View As a manager. Read the numbers in the screenshot against the acceptance criteria (e.g. "44 employees").

A stale bundle once made working scoping look broken for an hour. So hard refresh first, every time.

A **Runtime errors** banner right after a multi-file write can be transient. Have Saul reload `/dev` once and read the console text to you before deciding anything. Use this table:

| Signal | Infrastructure | The change |
|---|---|---|
| How many actions fail | many at once | one specific action |
| Message | `too many connections` | a real API / code error |
| After reload | gone | still there, with a fresh request id |

Never press **Fix**.

---

## 6. Keep or undo (step 6)

| Result | Saul does |
|---|---|
| PASS + screenshot right | Rename the zip `YYYY-MM-DD hub - <topic>.zip` and move it into `HR Hub\GOOD\`. It's the new baseline. Never delete old GOOD zips: they're the history |
| FAIL | UIB chat → on the message before the prompt → **Revert to this checkpoint**. Export again, and you confirm with the script that it matches GOOD (0/0/0). Then write a correction prompt |

Release (draft → staging/prod) is only ever Saul's call, after PASS.

---

## 7. End of chat (step 7)

Create these as downloads, then one table telling Saul where each goes:

| File | Goes to |
|---|---|
| `HANDOFF-<YYYY-MM-DD>-<topic>.md`: what's live, on draft, waiting on Saul; tests count; known reds | `HR Hub\handoffs\` + replace the old handoff in Project files |
| Prompt files | `HR Hub\prompts\<date>-<topic>\` |
| `LESSONS.md` / `BACKLOG.md`, full file, edited, only if something was learned | Replace in Project files + `HR Hub\kit\` |
| `hub-harness.zip`, only if tests changed | Replace in `HR Hub\kit\` (+ Project files, if it's stored there) |
| `AGENTS.md`, only if UIB changed it | Replace in Project files |

---

## 8. UIB facts that still hold (from `UIB-GUIDE-FOR-CLAUDE.md`)

- Instance `https://uib.vitasya.cloud`, org `vitasya`. Hub = `jAaT7LYarG`, Disciplinary Form = `PC3PsXDDa9`. The Form writes `disciplinary_actions`, which the Hub's Disciplinary page reads.
- **Two tabs only.** Tab 1 = builder `/edit/vitasya/jAaT7LYarG/builder/summary`, only for prompts. Tab 2 = `/dev/vitasya/jAaT7LYarG/<route>` for Export (⋮ next to *GAF Panama HR Hub*) and for looking. Never open a second builder tab: two `/edit/` sessions fight each other.
- `src/AGENTS.md` is UIB's own standing instruction file. It reads it before every change. Facts UIB keeps getting wrong belong there (via a prompt), not in each prompt.
- Done signal for a prompt: the textarea placeholder is back to `Ask UI Bakery...` **and** the last message is this prompt's summary. The placeholder flips back briefly mid-run, so check both. A long prompt takes 2-5 minutes, and a code-check "timeout" is not a failure.
- Builder edits are drafts. They appear on `/dev` at once and reach prod only on Release.
- Export is read-only and safe. Zip names go `GAF Panama HR Hub.zip`, `(1)`, `(2)`… Take the newest by time, not by number.
- There's no "import zip": changes only ever go in through the AI panel.
- `uib_migrations` (Database tab) is the real migration ledger. `src/migrations/applied.txt` is not reliable.
- Clean logs prove nothing about correctness.

## 9. Where things are in Project files

| File | Holds |
|---|---|
| `03-HUB-KIT.md` | This runbook |
| `AGENTS.md` | Technical rules: schema, timezone invariant, Monday integration, file map |
| `LESSONS.md` | Traps that cost time. Read it before PTO or the Directory sync |
| `BACKLOG.md` | Roadmap and known issues, ranked by payroll risk |
| `DESIGN-SYSTEM.md` | Colors, formats, components |
| `HANDOFF-*.md` (newest) | Current state |
| `verify_export.py` | The check script (`/mnt/project/verify_export.py`) |
| `hub-harness.zip` (optional) | The tests. If it's here, Saul doesn't attach it |
