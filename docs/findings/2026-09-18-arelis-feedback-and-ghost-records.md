# Arelis's feedback on the live screens, and the stray-record rule (2026-09-18, evening)

Arelis Acosta (manager) sent Saul comments on the Today tab, PTO and Disciplinary. What each one
turned out to be, with the evidence.

## 1. "Nichole's entry says 6:24 AM and On Time — she was not on time" → REAL DEFECT, fixed

Fri 2026-09-18: Nichole Harris, Charis Dixon, Monique Luque and Yessenia Moran each had a first
Teramind Time Record at exactly **06:24 Eastern**, under a minute long, followed by 137–177 minutes of
nothing; real work started 08:41–09:21. Four people in the same minute = a machine event, not an
arrival. The Hub (and payroll, with the file or the capture) takes the earliest record as the entry,
so Nichole (real start 09:20, Tardiness form on file) read "On Time".

Last 90 days (largest-gap heuristic): 23 of 2,477 employee-days look like this, 15 people; 8 hid a
late arrival.

**Rule shipped (Saul's OK, 2026-09-18):** leading records that end within
`teramind_ghost_max_minutes` (5) of the day's first start and are followed by
`teramind_ghost_gap_minutes` (60) or more of nothing are *ghosts*: ignored for entry, active time,
counts and gaps, never deleted. One SQL view, `v_teramind_records` (migration `1782012000`), read by
Today, Activity, the payroll capture and the Teramind-vs-Payroll comparison. Proven on a real
Postgres engine (pglite, 10 cases + a pushdown plan) before it reached UI Bakery. Flagged, not
hidden: "Early Record 6:24 AM Ignored" under the Entry on Today / Activity / the panel, and an amber
list on Process Payroll → Capture ("Early Stray Records Ignored — N") for Tim. The backup file upload
does **not** apply the rule (the parser is a protected payroll file) and the card says so.

After the rule, Sep 18 reads: Nichole 9:20 AM +20m (Tardiness), Yessenia 9:11 AM +11m, Charis 8:47,
Monique 8:41. Capture for Sep 11–18 lists five ignored records (those four + Michael Jones, Sat Sep
12, 4:08 AM → 9:45 AM). Released as **8.6.0 (staging) → 8.7.0 (staging + prod)**, verified on prod.

**A 9:00 clock-in followed by a 9:30 start is not affected** (30-minute gap < 60). Not adopted:
restricting the rule to records before the scheduled start (more SQL, slower pages) — revisit after
one period of real use.

## 2. "María shows On Time but came in late / you put it in gringo time" → NOT A DEFECT

Every time in the Hub is US Eastern (the page says so). María De Urriola's entry 8:37 AM Eastern is
7:37 AM Panama. Aleka's 9:11 AM Eastern = 8:11 Panama = +11m, which Arelis read correctly. Saul
declined a Panama-time switch.

## 3. "Navvad's December / January PTO is missing" → not in the source

The requests sync has no date window (28 future requests in the copy, one starting Dec 31). For
Navvad the copy holds only a Birthday Day Off (Sep 18 → 21) and five recorded items; nothing pending,
nothing unmatched. The requests are not on the Monday board under his name. Saul: "checks out for now".

## 4. "Tanya's PTO Oct 12–16 is missing" → it is there

PTO Tracker → Tanya Bedoya: recorded, leave Oct 12, return Oct 19, **7 days** (Monday's "total days
requested"). Oct 12–16 is 5 working days; her Aug 17 → 24 trip also says 7. If policy counts working
days only, her balance is 4 days low. **Open question for Saul — nothing changed.**

## 5. Three warnings "missing" (Monique written, Danny verbal, Tanya verbal) → never filed

The Disciplinary page reads the separate GAF Disciplinary Actions Form app. Ten people have actions
there; those three are not among them, not even under Deleted, and unmatched names are shown rather
than hidden. Arelis's own filings (Osvaldo, Eduardo, Aleka, Navvad) do appear.

## 6. Side find: María De Urriola has two unmatched permission requests

Submitted from a personal Gmail; the Monday tab already suggests the right employee. Saul will add
the alias.

## 7. Saul's question: "clock in near the shift start, then away 30+ minutes" (breakfast pattern)

Read-only probe (`prompts/2026-09-18-ghost-records/04-probe-clock-in-then-away.md`), last 90 days,
clean records: 2,479 employee-days · 1,155 started within ±10 minutes of the scheduled start ·
**9** of those were followed (within 15 minutes) by 30+ minutes of nothing · 8 people, one of them
twice (Gisselle Ramos ×2, avg 54 min; Arelis Acosta, Eder Quintero, Edwin Broce, Favian Fortune, Luis
Abad, Nichole Harris, Yessenia Moran ×1 each; gaps 30–48 min). It is not a pattern in this team.
