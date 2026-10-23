# One-time setup: HR Hub in Claude Enterprise

For Saul. About 30 minutes, once. After this, every change follows `04-CHEATSHEET.md`.

## What you're building

```
Work laptop                                Claude Enterprise
───────────                                ─────────────────
Documents\HR Hub\                          Project "GAF HR Hub"
  GOOD\      approved exports (history)      Instructions  ← 02-project-instructions.md
  kit\       script, tests, guides           Files         ← the kit\knowledge files
  prompts\   every prompt sent to UIB
  handoffs\  end-of-chat notes             Every chat: you attach the GOOD zips +
                                           hub-harness.zip; Claude checks UIB's work
```

**Three terms:**
- **GOOD zip:** an export of the app you've approved. The newest one is the "baseline": every new change gets compared against it. Older ones are your history (this replaces git).
- **Harness:** `hub-harness.zip` holds the 958 automated tests. Claude runs them on every export.
- **Project files:** documents Claude reads in every chat of that Project. They're its long-term memory, and they stay current only if you replace them when Claude hands you new versions.

---

## Step 1: unpack the kit (3 min)

1. Download `hr-hub-kit.zip` (from the Claude Code chat that built it).
2. Right-click it → **Extract All…** → choose `C:\Users\SaulFallembaum\Documents\`. You get a `HR Hub` folder with `GOOD`, `kit`, `prompts`, `handoffs`.
   (If your company prefers OneDrive, extract it inside your OneDrive folder instead. Same structure.)

## Step 2: make the first GOOD zips (5 min)

1. Chrome → `https://uib.vitasya.cloud/dev/vitasya/jAaT7LYarG/` → ⋮ next to *GAF Panama HR Hub* → **Export**.
2. In Downloads, rename the newest `GAF Panama HR Hub….zip` to `2026-10-23 hub - start.zip` and move it into `HR Hub\GOOD\`.
3. Same for the Form: `https://uib.vitasya.cloud/dev/vitasya/PC3PsXDDa9/` → ⋮ → **Export** → rename it `2026-10-23 form - start.zip` → `GOOD\`.

## Step 3: create the Project (10 min)

1. Claude Enterprise → sidebar **Projects** → **New project** → name `GAF HR Hub`.
2. **Instructions** (or *Set project instructions*): open `kit\02-project-instructions.md`, copy everything **below the line**, paste, save.
3. **Files** (or *Add content* / *Upload*): drag in everything from `kit\knowledge\`:
   `03-HUB-KIT.md`, `AGENTS.md`, `LESSONS.md`, `BACKLOG.md`, `DESIGN-SYSTEM.md`, `HANDOFF-2026-10-20-manager-refresh.md`, `verify_export.py`.
   - If it refuses `verify_export.py`, skip it. You'll attach it in each chat instead (it's in `kit\`).
4. Delete the old `HR Hub TEST` project, if you made one.

## Step 4: the self-check (10 min)

Open a **new chat inside `GAF HR Hub`**. Attach `GOOD\2026-10-23 hub - start.zip`, `GOOD\2026-10-23 form - start.zip` and `kit\hub-harness.zip`. Paste:

```text
Setup self-check for this Project. Run each step and paste the real output.
1. List the Project files you can see, by name.
2. From the code sandbox, try to find them on disk: ls -la /mnt /mnt/* and find / -name "03-HUB-KIT.md" 2>/dev/null. Paste the output.
3. Is verify_export.py reachable from code? If yes, copy it to ~/w. If no, say so plainly.
4. Run the start-of-chat baseline from section 2 of 03-HUB-KIT.md and paste the script's table.
5. In one line each: (a) must I attach verify_export.py in every chat? (b) did the baseline match what 03-HUB-KIT.md expects?
END OF PROMPT
```

What the answer means:

| Claude says | Do |
|---|---|
| Baseline 957/958, only **L2** red | ✅ Setup works |
| "verify_export.py not reachable from code" | Normal. Attach `kit\verify_export.py` in every chat, along with the zips |
| No Project files listed | The files didn't upload. Redo step 3.3 |
| Tests 0 / "CANNOT RUN" | Paste the answer into the Claude Code chat (if you still have one) or send me a screenshot. Don't start work yet |
| Other reds besides L2 | Your live app differs from the last check (2026-10-20). Ask Claude what each red means before any change |

Done. From now on: `04-CHEATSHEET.md`.
