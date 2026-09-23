# The code review, checked a second time — for Saul

*2026-09-23. Nothing in the app was changed.*

Yesterday's review (`2026-09-22-deep-code-review.md`) listed ten serious problems. Today each
one was re-checked by a reviewer whose only job was to **prove it wrong**. They read the code
again, and they also read your decision history (Backlog, handoffs, past prompts), which the
first review mostly skipped.

## The short version

- **One thing must be fixed before Thursday's payroll run.** The app will refuse to create
  Q2-Sep-2026. Details below.
- **Two of the ten were wrong.** The app is doing what you decided.
- **Two were right but smaller than claimed.**
- **The other six hold up.** None of them is on fire. All are worth fixing.

| # | What the first review said | Verdict after re-checking |
|---|---|---|
| 1 | Q2-Sep can't be created | ✅ **Real. Blocks Thursday.** |
| 2 | Managers' browsers load the full staff list in the background | ✅ Real |
| 3 | The "super users only" lock is only on the screen, not in the database | ✅ Real gap. Whether a manager could actually use it is unconfirmed |
| 4 | Saving an absence docks 8 hours instead of 7 | ❌ **Wrong.** 8 hours is your rule (Aug 11) |
| 5 | A deleted payroll day can come back hidden | ✅ Real. Has not happened yet |
| 6 | Unpaid leave and floating holidays skip Tim's review | ✅ Real. Goes against what you asked for on Aug 27 |
| 7 | Every Monday request is treated as approved | ❌ **Your decision** (Aug 27). A different real problem was found underneath it |
| 8 | The HRK file subtracts doctor-note hours twice | ⚠️ Real but rare. The "extra Saturday hours" part was wrong |
| 9 | A Monday hiccup can hide PTO requests and forms | ✅ Real. Fixes itself at the next good sync |
| 10 | Every manager downloads the whole disciplinary file | ✅ Real |
| 11 | Payroll Master's RED/YELLOW tabs miss rows past the first 500 | ✅ Real |

---

## 1. Before Thursday: the app will refuse to create Q2-Sep-2026

On Sep 10 you approved a safety check that catches typos in period names, after the
"Q1-Aug-20260" mix-up. It is too strict. It treats **Q2-Sep** as a typo of **Q1-Sep**, because
the two names differ by one character.

I ran it with the real names, and it refused. When Tim tries to process the second half of
September, he'll see a message telling him to pick Q1-Sep instead. Following that message would
**overwrite the first half of the month**.

Nobody has hit this yet, because Q2-Sep will be the first time since Sep 10 that a Q2 period is
created while its Q1 already exists. It will happen every month from now on.

**The fix is small and outside the protected payroll files.** It's one function that
has to learn that Q1 and Q2 of the same month are two different periods, plus a test for it.
**Tell Tim not to click through that message if he sees it.**

## 2. Managers' browsers quietly load the full staff list

There are three background jobs that keep the app up to date. Two of them only run when a super
user has the app open. The third one, which keeps manager groups in step with Monday, has no
such check. So when any of your 14 managers opens the Hub, their browser downloads the full
staff list and the full list of app users in the background. Those downloads include notes,
start and end dates, and roles. Sometimes it also updates the manager groups.

Nobody chose this. A past prompt noticed the check "might be missing" and left it for later.
**The fix is one line.** It's the most cost-effective fix on this list.

## 3. The "super users only" lock is on the screen, not in the database

When a page is for super users only, the app hides it from managers. The database behind it
doesn't check who is asking. For reading data this is fine: the database *does* check there,
and a manager can't pretend to be you. For **changing** data, nothing checks. In principle, a
manager using browser developer tools could make themselves a super user, or change a
payroll row.

Two things are unknown:
- **Whether UI Bakery lets someone trigger those actions from outside the page.** Your Sep 15
  investigation left that open.
- **How likely it is.** Your managers are trusted staff, not IT people.

**Realistic risk today: low to moderate.** The possible damage is serious, so it deserves a
proper answer. It's also the largest piece of work on this list.

## 4. ❌ Absences docked 8 hours instead of 7: not a bug

The first review had this backwards. On **Aug 11 you ruled that 8 hours is correct.** When Tim
confirms an absence as Unpaid, it becomes 8 hours, which is right. The wrong number is the
app's **first guess of 7 hours**, which stays on red rows nobody has resolved yet.

This was already in your Backlog as "resolved, never applied." One real side note: the
"Full-day absence discount" setting in Admin controls almost nothing, so changing it won't do
what it says.

## 5. A deleted payroll day can come back hidden

When a period is re-run, the app deletes days it no longer produces. You can restore them from
Period Log. If a later re-run produces that same day again, the app writes the correct numbers
into it **but leaves it marked deleted**. So the day exists but doesn't show in Payroll Master,
Action Required or the HRK file. Nobody gets an error.

This **has not happened yet**. The first review said it had, and that was wrong. **Thursday's run is
safe from it**, because Q2-Sep has never been run before. It will matter the first time someone
re-runs a period after fixing missing data, like the Sep 19 Saturday.

## 6. Unpaid leave and floating holidays skip Tim's review

On Aug 27 you asked that unpaid-leave days and Floating Holiday / Birthday days go to Tim for
review, because they can cost someone a day's pay. The app marks them yellow, but it also fills
in the answer itself. Because of that, it immediately counts them as done. They **never appear
in Action Required** and show as green in Payroll Master.

The amount docked (8 hours for unpaid leave) is right. The problem is that nobody confirms the
request was real, or that the person still had a floating holiday left. This has applied to
every such day since Aug 27.

## 7. ❌ Every request counts as approved: your decision, and a different real problem

On **Aug 27 you ruled that a request on the Monday board counts as approved.** The board has no
approved/denied column, so this is working as you decided.

**Your question to answer:** does the Permissions board ever hold a request a manager turned down, or
one still waiting? If it doesn't, nothing needs to change.

**The real problem found underneath it:** if someone has PTO booked but actually works that day,
payroll **ignores their clock-in and clock-out**. It marks the day as a normal green PTO day and
takes it off their balance. Holidays and absence forms already flag this situation for
review. PTO days don't.

## 8. The HRK file can subtract doctor-note hours twice: real, but rare

When part of a day is covered by a doctor's note and the rest is marked unpaid, the file for the
consultant can take the same hours off twice. It can be up to 8 extra hours for that day. In
the old imported data, 3 of 6 doctor-note days were affected. The clearest case is Ángela
Rodgers on Apr 8: 14 hours were taken off where the note says 4 + 4.

Two more things came out of this check:
- **One of Ángela's notes (May 20) produces *negative* doctor-note hours.** The way the time
  range is written confuses the reader, so she ends up with 8 hours *added*.
- **Correcting the doctor-note hours on the HRK screen doesn't update worked hours.** Tim can't
  fix it by hand from there.

The first review's other claim was that everyone gets 8 extra hours for Saturdays. **That was
wrong.** It's the paid weekly rest day you ruled on Aug 25.

## 9. A Monday hiccup can hide PTO requests and forms until the next sync

The app reads large Monday boards in chunks of 500. The Attendance Forms board has over 1,000
items. If one chunk fails, the app doesn't notice. It assumes everything it didn't receive was
deleted on Monday, and hides it.

The next successful sync brings everything back automatically. Until then, pending PTO,
contracts and attendance forms can look like they vanished. That could be a long time if nobody
has the Hub open.

## 10. Every manager downloads the whole disciplinary file

When a manager opens Disciplinary, their browser receives **every** employee's cases, with the
full written details, and then hides the rows that aren't theirs. It's visible to anyone who
opens the browser's network tools.

The cause was a known limit when the page was built: the disciplinary forms live in a separate
database that can't be filtered at the source. What nobody ever decided was whether the
privacy side of that is acceptable. **The fix is known:** send the database the list of people
each manager may see.

## 11. Payroll Master's colour tabs miss rows beyond the first 500

Payroll Master loads 500 rows per page, and a busy period has more. The RED and YELLOW tabs and
the CSV export only look at **the page you're on**, not the whole period. The total at the
bottom is right, but the rows listed under RED may not be all of them.

---

## Questions only you (or Tim) can answer

1. **Permissions board:** does it ever hold a request that was turned down or is still waiting?
2. **7 vs 8 hours:** your Aug 11 ruling was never applied to the app's first guess. Apply it now?
3. **Leavers:** when someone leaves mid-period, are they still marked active at the next payroll
   run? The HRK file counts their hours to the end of the period.
4. **Disciplinary privacy:** is it acceptable, even briefly, that managers' browsers receive
   other teams' cases? This decides how urgent #10 is.

## Suggested order

1. **Now:** #1, the Q2-Sep name check. Small, not a protected file, needed by Thursday.
2. **This week:** #2 (one line) and #10 (privacy).
3. **Next, one at a time, each with your OK** (they're in the protected payroll files):
   #6, then the PTO-worked-day problem from #7, #5, #11, #8.
4. **Plan properly:** #3 (database-side checks on every change), and #9.

## What the other ~55 smaller items are

Yesterday's long list has about 55 smaller items. **They were not re-checked.** Treat them as
leads. Going by today, roughly one in five will turn out wrong or already decided, so each
one gets checked before any work starts.

## About how the review was done

- **What worked:** the strongest model (Opus) on the payroll code found the real problems.
  A second pass whose only job was to disprove each claim caught two false alarms.
- **What didn't:** the fastest model (Haiku) did the rules sweep and reported "all clear" on
  staff-data access. It missed #2 and #10. It's fine for simple counting, not for judgement.
- **The biggest lesson:** both false alarms came from the first review not reading your past
  decisions. Next time, every reviewer gets the Backlog and handoffs up front, and every finding
  gets a "prove it wrong" pass before it reaches you. That beats adding more models.
