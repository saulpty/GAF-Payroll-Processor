# How we work on GAF HR Hub

A plain-language guide. Written for you, not for a developer.
If something here stops matching reality, say so and we'll fix the doc.

---

## The three places your app lives

Understanding this one picture removes most of the confusion.

**1. UI Bakery — the real app.**
This is the only place the app actually runs, and the only place it gets
edited. Your employees use it. The database lives here. If UIB disappeared,
the app would be gone. **UIB is the truth.**

**2. Your laptop — a copy for checking things.**
A folder at `Documents\GAF-Payroll-Processor`. It is a photocopy of UIB's
code. It does not run. Nothing here affects the live app. Its whole job is
to let us answer one question: *what exactly changed?*

The folder keeps its original name even though the UIB project was renamed
to *GAF HR Hub*. Renaming it would have bought nothing and cost a session
restart, so it stays. Only the name differs — the contents mirror *GAF HR
Hub*.

**3. GitHub — a backup of the copy.**
An off-site shelf. If your laptop dies, the history survives. That's all it
does. Nobody else uses it, nothing deploys from it.

The direction only ever goes **UIB → laptop → GitHub**. Nothing flows back
into UIB from the laptop automatically. That's deliberate.

---

## What we do NOT use

You ran into these before. They're gone, and here's why.

**Branches** — a branch is a parallel copy of the code so several people can
work without colliding. There is one of you. You will have exactly one
branch, called `main`, forever. Nothing to switch, nothing to choose.

**Pull requests and merges** — a pull request is how one developer asks
another to review their work before combining it. There is nobody to ask.
You will never open one.

**Connecting UIB to git** — this is the big one, and it's what confused you.
UIB *can* connect to GitHub, but doing so forces the full ceremony: it locks
the `main` branch so you can't edit, and requires branch → commit → push →
pull request → approve → merge → pull back, for every single change. It also
**disables UIB's own version history**, so you'd lose the ability to restore
a previous version from inside UIB.

We are not connecting it. You keep UIB's version history, and we get change
tracking a simpler way.

---

## The buttons in UI Bakery

**Preview** — shows the app as your users see it. Looking, not changing.

**Release / Publish** — this is *deployment*, and it has nothing to do with
GitHub. Your edits in the builder are a draft. Release pushes that draft out
to the live app that people actually use. Staging is a practice version;
production is the real one.

The rule: **edit freely, release deliberately.** Nothing you do in the
builder reaches your employees until you press Release.

**Export** — downloads the whole app as a `.zip` to your Downloads folder.
This is how code gets to your laptop. It changes nothing and is completely
safe. Press it as often as you like.

**Connect Git** — don't. See above.

**Logs** — what the app did while you were clicking. Useful when something
errors. Currently clean: 0 errors, 0 warnings.

**Database** — the tables behind the app. You can browse, filter, and run
queries here. This is where I'll ask you to run SQL when I need to check
something.

---

## The normal working loop

This is the whole process. Six steps, and you only do three of them.

**1. You press Export in UIB.** The zip lands in Downloads.

**2. I sync it.** One command pulls the zip into your laptop folder and
tells me exactly which files changed since last time.

**3. I write the instruction.** I read the real code and write a precise
prompt — which files may change, which must not be touched, what "correct"
looks like when it's done.

**4. You paste it into UIB's AI panel** (or I drive it in Chrome).

**5. You press Export again. I sync again.**

Now the important part. I compare before and after. If you asked to fix the
Period Log and the comparison shows the payroll calculation file also
changed — **we catch it right there**, before it touches anyone's paycheck.

**6. Good change → I save it to history and back it up. Bad change → we
send it back to UIB with the exact list of what it broke.**

Step 5 is the entire point of this setup. It's the difference between
"I think that worked" and "I know what that changed."

The precise commands behind steps 2, 5 and 6 are in
[CHANGE-LOOP.md](CHANGE-LOOP.md) — that is Claude's runbook, not yours.

---

## Why your app has been breaking

Three specific reasons, all fixable:

**No standing instructions.** UIB has a file called `AGENTS.md` that its AI
reads before every single change — schema, rules, conventions, things it
must never do. Yours was **completely empty**. So every prompt started from
zero. That's why you had to keep re-explaining things like which Monday.com
column holds the manager. We're filling it in.

**Some files are enormous.** `ProcessPayroll` is 53,000 characters. When an
AI edits a file that size, it loses track of the parts it isn't looking at
and breaks them. This is the main cause of "I asked for one thing and
something else broke." We'll split those files, but carefully, one at a time.

**Nothing was checking the work.** Until now there was no way to see what a
change actually touched. That's what the loop above fixes.

---

## How to ask for changes well

The difference between a good and bad result is mostly the prompt.

**Say what "done" looks like, not how to build it.** "The period total
should exclude deleted entries" beats "add a filter to the query."

**One thing at a time.** Three requests in one prompt produce a change too
big to review, and if one part is wrong you can't tell which.

**Name the page.** "On Period Log, the rename button…" not "the rename
thing."

**Times and dates need a warning.** This app has about ten separate
migrations that are all fixes to the same timezone bug. Any change touching
times must say: *this app stores everything in US Eastern; do not convert
timezones.* Otherwise it gets reintroduced.

**If it gets it wrong, don't pile on.** Adding "no I meant…" on top of a bad
change stacks confusion. Better to discard and re-ask cleanly.

---

## If something goes wrong

**A change broke the live app** — in UIB, restore a previous version from
its release history. This still works because we did not connect git. This
is your fastest undo.

**A change broke something subtle** — tell me. The laptop copy has every
previous version, so I can show you exactly what changed and when.

**You're not sure whether something is live** — if you haven't pressed
Release, your users aren't seeing it.

**Your laptop dies** — the code is on GitHub and the app is on UIB. Neither
depends on your machine.

---

## What I need from you

Only three things, ever:

1. **Press Export** when I ask, and tell me it's done.
2. **Run SQL I hand you** in UIB's Database tab, and paste back the result.
   I'll only ever ask for structure and counts — never employee personal
   data.
3. **Tell me when something looks wrong**, even vaguely. "The June numbers
   feel off" is a useful bug report. I'll find the specifics.

You never need to touch git, branches, or GitHub. That's my side.
