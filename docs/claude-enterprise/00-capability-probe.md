# Claude Enterprise capability probe

**Why this exists:** on 2026-10-22 Saul moved to Claude Enterprise, which is chat only: no
Claude Code, no Claude in Chrome, no Cowork, and GitHub can't be connected. Before we build
the HR Hub Project kit, we need to know what Enterprise chat can actually *do*. That
decides how UIB changes get checked from now on. A model's description of itself is a
claim, not evidence, so this probe makes it run each test and paste the output.

Takes about 15 minutes. Three parts: A (click around), B (set up a test Project), C (paste the prompt).

---

## Part A: check the screens yourself (5 min, screenshot each one)

| # | Where to click | What to write down |
|---|---|---|
| A1 | Left sidebar | Is there a **Projects** item? |
| A2 | Your name (bottom left) → **Settings** | The names of every tab on the left |
| A3 | Settings → **Capabilities** (or *Features*) | Every toggle you see, and whether it's on or off. Look for *Code execution*, *File creation*, *Artifacts*, *Memory*, *Web search* |
| A4 | Settings → **Connectors** (or *Integrations*) | Every connector listed, connected or not (Microsoft 365, SharePoint, OneDrive, Google Drive, GitHub, Monday…) |
| A5 | Settings → **Skills** (if it exists) | Is there an **Upload skill** or **Create skill** button? |
| A6 | Chat box → the **+** or 🔧 button | What options it offers (upload, connectors, research, model picker) |

## Part B: set up a test Project (3 min)

1. Sidebar → **Projects** → **New project**. Name: `HR Hub TEST` (it gets deleted afterwards).
2. Add to the Project's knowledge: one file from the laptop,
   `C:\Users\SaulFallembaum\Documents\GAF-Payroll-Processor\docs\LESSONS.md` (43 KB).
3. Open a new chat **inside that Project**.
4. Attach the **two newest** UIB exports from `Downloads`
   (e.g. `GAF Panama HR Hub (7).zip` and `GAF Panama HR Hub (8).zip`), plus one screenshot of
   any HR Hub page.

If Projects don't exist (A1 = no), do C in a normal chat and skip test 9.

## Part C: paste this whole block into that chat

~~~text
I need a verified inventory of what you can do in this workspace. Do NOT describe yourself from memory. For every test, actually perform it and paste the raw output (or the exact error). If you cannot perform a test, say "NOT RUN" and why. Do not skip any test and do not summarize the outputs away.

TESTS

1. Code sandbox. Run: python3 -c "import sys,platform; print(sys.version); print(platform.platform())". Paste the output.

2. Open a zip. I attached two UIB export zips. For the NEWER one: unzip it, then paste the total file count, the total size, the 10 largest files (path + bytes), and the SHA-256 of src/AGENTS.md.

3. Diff two zips. Compare the OLDER zip to the NEWER one. Paste the counts of added / changed / removed files, the path of each, and a unified diff (first 40 lines) of one changed file under src/. If nothing differs, say so and prove it with the SHA-256 of 3 files from each.

4. Node.js. Run: node --version. Then write this file to test.test.ts:
   import { test } from 'node:test'; import assert from 'node:assert'; test('ok', () => assert.equal(1+1, 2));
   and run: node --test test.test.ts. Paste both outputs. If node is missing, try to install it and paste what happened.

5. Persistence. Run: echo probe-$(date +%s) > /tmp/probe.txt && cat /tmp/probe.txt. I will ask you to cat it again in my next message, to see whether files survive between messages.

6. File creation. Create two files I can download: probe.md (one line of text) and probe.zip (containing probe.md). Tell me whether download links appear.

7. Web access. Fetch https://docs.uibakery.io and paste its page title. Then try https://uib.vitasya.cloud and paste what happens (it's a private, logged-in site, so failure is expected; I want the exact error).

8. Skills. List by name every skill you have loaded right now (one that was mentioned earlier was "file-reading"). For each one, a one-line description. Then: can a user or admin upload a custom skill in this workspace? Answer only from what you can see, and say "unknown" if you cannot see it.

9. Project knowledge. This chat is inside a Project with LESSONS.md in its knowledge. (a) Quote the first heading of LESSONS.md. (b) From the code sandbox, try to list or read the Project knowledge files (e.g. look under /mnt, /home, the working directory). Paste what you find. I need to know whether code can read Project files or only you can.

10. Vision. I attached a screenshot. Quote 5 exact pieces of text you can read in it.

11. Limits. Report, citing your source or saying "estimate": your context window size, the max size per uploaded file, the max files per chat, and the Project knowledge limit.

12. Tools and connectors. List every tool and connector you can call right now, by its exact name. Flag any that touch Microsoft 365 / SharePoint / OneDrive, Monday.com, GitHub, or Google Drive.

13. Model. Which model are you, as shown by the system, and is extended thinking available?

OUTPUT FORMAT
First, one table: | # | Test | Ran or only claimed? | Result (yes / no / partial) | Key evidence |
Then the raw outputs, numbered 1-13.
Finally, a short "What this means" list: which of these work in this workspace, (a) replacing a git diff of UI Bakery exports, (b) running a Node test suite, (c) keeping long-lived reference docs.
~~~

After it answers, send one more message in the same chat:

~~~text
Test 5 follow-up: run cat /tmp/probe.txt and paste the output.
~~~

## Bringing the results back

Copy the whole answer (both messages) and paste it into the Claude Code session that wrote this
file, along with your Part A screenshots. Then delete the `HR Hub TEST` project.

## What each result decides

| If… | Then the HR Hub loop checks UIB changes by… |
|---|---|
| Tests 2 + 3 pass | Uploading the old and new export zips to chat. Claude lists exactly which files changed (replaces `git status`) |
| Test 4 passes too | Also running the test suite in chat, if `tests/` is uploaded |
| Test 3 or 4 fails | Double-clicking a `Sync-And-Check` script on the laptop (Node + Git are already there), then pasting its output into chat |
| Test 5 passes | Keeping the previous export in the sandbox between messages, so only one zip is needed per change |
| Test 9b passes | Keeping the last good export in Project knowledge as the baseline |
| Test 8: custom skills allowed | Packaging the change loop as a skill instead of a long instruction block |
| Test 12 shows Microsoft 365 / OneDrive | Using it as the work-side home for the docs (domain wall: off the personal GitHub) |
