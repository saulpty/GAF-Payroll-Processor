# QA — Capture From Teramind vs the export file, 2026-09-11 → 2026-09-17

**Question:** does the new *Capture From Teramind* hand the payroll engine exactly what an
uploaded Time Records file would? (Saul's ask, 2026-09-18: "couldn't we just do that test now up
to today's date as QA?")

**Method (read-only, nothing written to the database):**
1. On `/dev` → Payroll → Process, dates 2026-09-11 → 2026-09-17, *Capture From Teramind*
   (fresh pull: 44 employees · 208 employee-days · 3,120 records), then *Use Saved Copy*.
2. The exact `loadTeramindPunchDays` response the capture uses was taken off the page
   (XHR hook) and saved as `Downloads/qa_punchdays_2026-09-11_17.json` (208 rows).
3. Saul's export `Time_records_56PCs_44Employees_2026-09-11_2026-09-17.csv` (2,735 rows, 40
   names) was folded the way the parser does (earliest start / latest finish per person per
   start date, minute precision) and compared per employee-day.
   Script: `tools/qa-compare-capture-vs-file.mjs` (mirrors `parseWallClock` + the fold, because
   `teramindParser.ts` imports `xlsx`, which is not installed outside UIB).

**Result**

| | |
|---|---|
| Employee-days in both | **181** |
| Identical entry and exit (to the minute) | **181** |
| Different | **0** |
| File-only | 0 |
| Capture-only | 27 — 5 people absent from the file entirely (yessenia.m, jose.d, gigi.s, ely.m, charles.b) and Jeanine Puyol's 09-15 → 09-17 |

The 27 capture-only days are not a capture defect: the file has 40 names although its own
filename says 44 employees and **56 PCs** — the export was taken with a computer filter that
left out those people's (or their newer) machines. The API pull has no such filter; it reads
every linked account. This is an argument *for* the API path: a forgotten PC filter on the
export silently drops people from payroll.

**Not done on purpose:** no engine run was made with the captured punches. `/dev` shares the
live database, and a run writes `periods`, `payroll_entries` and `run_snapshots`; a QA period
would have to be removed by hand afterwards. Since the engine's input is proven identical, the
first real run (Q2-Sep-2026, morning of 2026-09-26, with the file downloaded that day as a
safety net) is the engine test.

**Open with Saul:** confirm the export was taken with a PC filter (56 of more), and that Tim's
usual export selects all computers.
