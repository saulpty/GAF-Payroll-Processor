# Probe results — 2026-09-17

Two sources. **(A)** UIB's AI answered questions 1, 2 and 7 and fetched the payroll rows for 6; its
inspector tool **blocks every POST**, so it could not run the session queries. **(B)** Questions 3–6
and 8 were answered by opening the VP's *Work Pattern Monitor* (app id `FhroHPxJrv`, same instance,
same `Teramind API` datasource) in a signed-in browser, reading the raw responses it receives, and
replaying its own login-session request with different date ranges. Read-only; only counts, shapes
and one employee's times were taken out of the page.

## Answers

| # | Question | Answer |
|---|---|---|
| 1 | `datasourceName` | **`'Teramind API'`**. Others: `GAF Planilla DB`, `Monday.com API`, `Monday.com API v2`, `SAUL Disciplinary Action Forms DB`. |
| 2a | Agent fields | Default: `agent_id, name, email_address, avatar`. With `?fields=…` also `department_id, deleted (0/1), status, last_web_login, online (bool)`. |
| 2b | Email field | **`email_address`**. |
| 2c | Agents | 937 total; **655 deleted**, 206 online at 14:40 ET. Secondary machine-name agents exist (`wsiaccount@…`, `user@desktop-…`). |
| 2d | Match to employees | **45 of 45 active employees match exactly one agent** by email (case-insensitive). 0 multi, 0 none. |
| 3a | Response shape | **Bare array.** Keys: `agent, computer, date, time_s, timestamp`. |
| 3b | Timestamp | `"2026-08-26T09:00:12-04:00"` — ISO with the **Eastern offset** (we ask for `America/New_York`). `date` is plain `YYYY-MM-DD` and always equals the first 10 chars of `timestamp` (0 mismatches in 4,297 rows). |
| 3c | `agent` shape | **`[id, name, email]`** (number, string, string). `computer` is `[id, name]`. |
| 3d | `time_s` | Session length in seconds — **but not trustworthy on its own**: of 4,297 company rows, 278 were over 12 h, 138 over 24 h, max **691,200 s = exactly 8 days** (machines never logged out). A date-range query also returns these old sessions when they *overlap* the range (a 09-17 query returned rows dated 09-04 … 09-16). |
| 3e | Two days, whole company | 669 rows. |
| 3f | Agent filter | `agent:{in:[…]}` → **400** `'dim_filters->agent->range': field required`. `agent:{range:[374,374]}` → **0 rows, no error** (the same two days hold 4 rows for that agent). **The cube cannot be filtered by agent — filter in our code.** |
| 4 | One 15-day period, whole company | **7,384 rows** — far below the 50,000 cap. |
| 5 | History | Rows exist for 2026-03-11 (662), 2026-01-12 (622) and **2025-09-15 (395)** → every past period can be checked. |
| 6 | Smell test | Elizabeth Mootoo (employee 26, agent 374). API 2026-08-11: first start **08:56:56**, last end **17:01:16**. Payroll row: entry **8:56 AM**, exit **5:01 PM**. 08-12: two sessions 08:54:45→13:52:32 and 14:52:48→17:00:51. 08-13: 08:29:00→17:01:28. **Match.** |
| 7 | Scheduling | **Yes — UI Bakery Automations** run server-side on a timer with no browser open. They are configured in the platform UI, outside this project's files (so outside the export/diff loop). |
| 8 | Freshness | **Not live.** At 14:37 ET on 09-17 the newest session anywhere was `2026-09-16T23:54:34`; a query for 09-17 alone returned only older overlapping sessions. The `activity` cube likewise ended at 09-16. **Both cubes are complete through yesterday and hold nothing for today.** The only live signal is `online` on `/v1/agents`. |

## How UIB sends an HTTP action (seen on the wire)

`POST /api/httpsource/Teramind%20API/request` with the whole request — method, url, params, body —
**built in the browser**. So any signed-in user of any app with this datasource can send it any
query. Nothing we can fix from the Hub; it means viewer scoping can only ever be enforced on **our
saved copy**, never on the live API. Worth telling the VP.

## Decisions locked by the probe

- **G-TZ:** timestamps are instants with an explicit offset → `teramindTime.sessionClock()` converts to
  Eastern clock text (the offset is already Eastern, but we convert from the instant rather than
  slicing the string, so a future change of offset cannot shift an hour).
- **G-FILTER:** no agent filter. Pull the whole company for the range (≈500 rows/day), keep only
  sessions of **linked** agents before saving. Only super users pull.
- **Identity:** link on `email_address`; one agent per employee today, table still allows many.
- **Long sessions:** save the raw length, but **cap the finish at the end of the start day + 12 h**
  when building punches? — NO silent rule yet. Phase C's comparison shows how the uploaded report
  treated these; decide with Saul from real cases.
- **"Live" means through yesterday** for arrival/exit times; **online-now is truly live.** The
  keep-fresh sync only needs to run once each morning (an Automation, or first super-user open).
- **Capture timing:** a period can be captured from the API from the **morning after it ends**.
  A same-day (mid-day) run still needs the uploaded file — one more reason the backup stays.

## Addendum (same day) — can we get TODAY's entry time?

Saul's requirement: no file uploads at all, and today's arrivals visible today.

| Tried | Result |
|---|---|
| `login_session` / `activity` cubes for today | Empty — the BI cubes are complete through yesterday only. |
| Other cube names (≈45 guesses) | Only `activity`, `login_session`, `task`, `computer`, `agent` exist. None carries today. |
| REST guesses (`/v1/sessions`, `/v1/activity`, `/v1/computers`, `/v1/agents/{id}/sessions`, …) | 400 "could not find the requested resource". |
| `/v1/agents?fields=…,online` | **Live** `online` flag per agent (206 online at 14:40 ET). `last_web_login` is the dashboard login, null for agents. |
| **`GET /v1/activity/aggregated?from=D&to=D&agents=374`** | **Live for today** — per-app/site rows `{date, total (seconds), idle, agent_id, name, app, classify}`; the `agents` filter works; `from`/`to` accept dates only (timestamps are rejected). Summing `total` gives today's active time so far. **No timestamps**, so no first-activity time. Slow without an agent filter. |

**Conclusion:** the API never states "first activity today". Exact entry/exit for a day become
available the next morning (login sessions). For *today* the Hub can keep its **own clock**: a
server-side UIB Automation every ~5 minutes reads the `online` flags (one cheap call for everyone)
and records, per linked employee, `first_seen_et` / `last_seen_et` for the day → arrival accurate to
the polling interval, replaced by the exact session times the next morning. `activity/aggregated`
adds "active so far today". This belongs to the Live phase (E), not to payroll capture: payroll
captures from the morning after a period ends use exact times and never need a file.
