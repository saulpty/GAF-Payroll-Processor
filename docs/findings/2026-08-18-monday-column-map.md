# Monday.com board and column map — 2026-08-18

Authoritative `id → title → type` for the four boards the app uses. Read from
Monday's own API Playground (`vitasya-hc.monday.com/apps/playground`, which
authenticates with the logged-in session), query:

```
{ boards(ids: [18394590373, 9542698245, 8592460836, 8661565945]) { id name columns { id title type } } }
```

These are measured values, not inferred. Anything below may be pasted into
`classification_config`. **Nothing here was guessed** — see `src/AGENTS.md`,
"Why the config is authoritative".

## Board identities — two long-standing questions settled

| Board ID | Real name (verbatim) | Columns |
|---|---|---|
| `18394590373` | 🔐 Permissions & Requests | 25 |
| `9542698245` | ⏰ GAF Attendance | 12 |
| `8661565945` | 🚀 Employee Onboarding | 55 |
| `8592460836` | 🌎 Panama Employee Directory | 31 |

1. **`8592460836` is the directory; `8661565945` is Onboarding.** Migration
   `1781400400` had "corrected" `monday_board_directory` to `8661565945`, which
   was wrong — it pointed the directory at the Onboarding board. Migration
   `1781803400` set it back to `8592460836`. That reversal is now confirmed
   against Monday itself, not just owner memory. `monday_board_onboarding`
   should be seeded `8661565945`.
2. **`fetchMondayStartDates.ts` queries `8661565945`** — the Onboarding board.
   That is correct for start dates: `date_mknz53sh` ("Start Date") lives there,
   not on the directory.

## The manager-column incident, confirmed

`src/AGENTS.md` records that the directory sync once read `text_mkzj8b73`
instead of `text_mkzj84w1` for manager, and that both were valid columns so
nothing errored. Confirmed exactly:

- `text_mkzj84w1` = **Manager** (the name)
- `text_mkzj8b73` = **Manager Email**

Two adjacent, similarly-named IDs holding different data — which is precisely
why a wrong ID produces plausible-looking wrong data rather than an error.

Related: migration `1781400400` also set `monday_col_directory_role` to the
literal string `text`. The backlog called this "a column TYPE, not an ID".
That is right in effect but worth a footnote: `text` **is** a real column ID —
it is "Position" on the *Onboarding* board. So the value was a valid ID for the
wrong board, which is the same failure mode again, not a typo.

## All four directory keys verify against migration 1781803400

| Config key | Seeded value | Real title | ✓ |
|---|---|---|---|
| `monday_col_directory_role` | `text_mm63b2xk` | Role | ✅ |
| `monday_col_directory_manager` | `text_mkzj84w1` | Manager | ✅ |
| `monday_col_directory_active` | `color_mkyjv6et` | Status | ✅ |
| `monday_col_directory_email` | `text_mkzjgsxv` | Company Email | ✅ |

The four existing Permissions/Attendance keys also verify:
`email_mkzjqdh7` = Email, `date_rangeye9vcz9z` = Date(s) Requested,
`single_selectogxov2i` = Request Type, `single_select889imtb` = Permission Type,
`email_mkzjpqgt` = Company Email, `date0d5ep965` = Date,
`single_selectjxb85m6` = Type of Report, `color_mksnwwxd` = Reason.

## Traps on these boards — read before writing a parser

- **Permissions has TWO columns titled "Total Days Requested":**
  `short_text7o6c1a6j` and `short_textzk2linnu`. In the 2026-08-18 Excel export
  the first (spreadsheet column P) carries values for PTO/Vacation rows and the
  second (column Y) is empty. Use `short_text7o6c1a6j`.
- **Permissions has TWO "Acknowledgement" checkboxes:** `booleanzdqzektx` and
  `booleanyvid0avx`. In the export, Time-off rows tick the first, PTO rows tick
  the second. Do not treat either as an approval flag.
- **GAF Attendance has THREE columns titled "Name":** `name` (the item name),
  `color_mksneyjd` (a status), and `board_relation_mksnaawz` (a link). Only
  `name` is the employee's typed name.
- **Several fields are `mirror`/`lookup` columns** (Job Title, Employee Email,
  Manager Email on Permissions; Manager Email and Role on Attendance; State on
  Onboarding). Mirrors return text via `column_values.text` but their `value`
  JSON differs from a native column — read `text`, not `value`.
- **`8661565945` "Employee Onboarding" has 55 columns**, most of them onboarding
  checklist statuses irrelevant to payroll. Only Position, State, Manager,
  Manager Email, Start Date, 3 Months, 6 Contract End Date and 1year matter here.

## Column IDs to seed (Task 4 of the mirror/PTO plan)

### Permissions & Requests — 18394590373
| Purpose | Column ID | Title | Type |
|---|---|---|---|
| name | `name` | Name | name |
| email | `email_mkzjqdh7` | Email | email |
| manager email | `lookup_mkzhhh4q` | Manager Email | mirror |
| job title | `lookup_mkzh8x4q` | Job Title | mirror |
| employee email | `lookup_mkzhc2az` | Employee Email | mirror |
| request type | `single_selectogxov2i` | Request Type | status |
| permission type | `single_select889imtb` | Permission Type | status |
| date range | `date_rangeye9vcz9z` | Date(s) Requested | timeline |
| return date | `dateecjdq0rz` | Return to Work Date | date |
| start datetime | `datecv81o9oh` | Start Date & Time | date |
| end datetime | `datezy89br45` | End Date & Time | date |
| total days | `short_text7o6c1a6j` | Total Days Requested | text |
| hours approved | `numberutelbza0` | Hours Per Day Approved: | numbers |
| reason | `single_selectq0dq645` | Reason | status |
| details | `long_textmn2wtwum` | Details | long_text |
| submitted | `dategd1mzgql` | Date Submission | date |

### GAF Attendance — 9542698245
| Purpose | Column ID | Title | Type |
|---|---|---|---|
| email | `email_mkzjpqgt` | Company Email | email |
| date | `date0d5ep965` | Date | date |
| type | `single_selectjxb85m6` | Type of Report | status |
| reason | `color_mksnwwxd` | Reason | status |
| details | `text_mksn4fnb` | Details | text |
| eta | `single_selectu8a0ezg` | ETA | status |
| manager email | `lookup_mktcdbfj` | Manager Email | mirror |
| role | `lookup_mm156cye` | Role | mirror |

### Employee Onboarding — 8661565945
| Purpose | Column ID | Title | Type |
|---|---|---|---|
| position | `text` | Position | text |
| state | `lookup_mktc2x46` | State | mirror |
| manager | `text_mkptja09` | Manager | text |
| manager email | `email_mktc7p9z` | Manager Email | email |
| start date | `date_mknz53sh` | Start Date | date |
| contract end | `date_mkzhvk0f` | 6 Contract End Date | date |
| 3 months | `date_mm2pgzk7` | 3 Months | date |
| 1 year | `formula_mm6a1fy9` | 1year | formula |

### Panama Employee Directory — 8592460836 (already in config, verified)
`text_mm63b2xk` Role · `text_mkzj84w1` Manager · `text_mkzj8b73` Manager Email ·
`text_mm15y2vw` Manager 2 Email · `color_mkyjv6et` Status ·
`color_mkpt5gk4` State · `text_mkzjgsxv` Company Email ·
`lookup_mkpt573c` Day 1 · `lookup_mkzh6svr` Contract End Date ·
`lookup_mkzh25xs` 1yr Milestone · `date_mkzj1jpd` Birth date

## How to re-run this

The UIB agent sandbox **cannot** do it: `callInspectActions` permits only
GET/HEAD/OPTIONS and Monday's GraphQL needs POST. Only the UIB browser runtime
can execute a Monday action. The playground above is the quickest route and
needs no token — it uses the logged-in Monday session.
