# Live Attendance Dashboard — Build Specification

**Created:** 2026-06-15 | **For:** GAF Planilla Payroll Manager | **DB:** PostgreSQL (Hosted in UI Bakery)

---

## A. DATABASE — BLOCKING

### 1. Database Engine & Version
**✓ PostgreSQL (Hosted)** via UI Bakery `hostedPostgres` — **`GAF Planilla DB`**
- No version constraint visible in metadata, but standard Postgres 12+ features assumed (window functions, CTEs, JSON ops)
- **Timezone Support:** Full support for `AT TIME ZONE` — Postgres is the reference implementation

### 2. View Creation & Schema
**✓ Views ARE supported.** Schema name: **`public`** (standard)
- You can CREATE VIEW or CREATE MATERIALIZED VIEW in this database
- All tables are in `public.*` namespace
- Prepared statements are **ENABLED** on this datasource

---

## B. TERAMIND TABLE — BLOCKING

### 3. Raw Data Storage & Column Names
**⚠️ IMPORTANT:** Teramind data is **NOT persistently stored in the database** — it's parsed **in-memory during the Process Payroll run** from the uploaded CSV/XLSX file.

- **Upload Flow:** User uploads CSV/XLSX via ProcessPayroll UI → `parseTeramindFile()` parses it in browser
- **Raw Columns Expected:**
  ```
  • Employee (fuzzy match: "email", "user", "employee") → stored as `email` string
  • Time Started (fuzzy match: "time started", "start time", "started", "login", "first activity")
  • Time Finished (fuzzy match: "time finished", "end time", "finished", "logout", "last activity")
  ```
- **Parser Output Type (`TeramindRawRow`):**
  ```typescript
  {
    email: string;           // raw value: could be email, name, or MacBook hostname
    timeStarted: string;     // parsed as string, then converted to Date
    timeFinished: string;    // parsed as string, then converted to Date
  }
  ```

**Processed Teramind data is stored as a JSON snapshot** in `public.run_snapshots` after each run:
- `snapshot_type = 'teramind'`
- `raw_data` = JSON array of up to 100 sample `TeramindRawRow` objects
- `created_at` = `timestamptz` (UTC)

### 4. Data Accumulation
**NOT cumulative.** Each Process Payroll run:
- Accepts a NEW Teramind CSV (complete period)
- Parses in-memory only
- If re-running a period, **deletes and replaces** all `payroll_entries` for that `period_name`

**Batch/upload tracking:** No `batch_id` or upload date column. Snapshots are grouped by `period_name`.

### 5. Employee Identity Format
**Sample raw values from Teramind email column vary by customer setup:**
```
Examples:
• "john.smith@example.com"               (canonical email)
• "john.smith"                            (username)
• "john.smith@johnsMacBookPro"           (MacBook hostname)
• "John Smith"                            (display name — rare)
```

**Normalization:** `normalizeName()` function converts any input to lowercase + trim + remove punctuation for fuzzy matching against `employees.display_name` and `name_aliases.alias_text`.

### 6. Timestamp Column & Timezone
**Column Name (in TeramindRawRow):** `timeStarted` / `timeFinished` (ISO string initially)
- **Storage:** Parsed as Date → converted via `parseTeramindTimestamp()` (accepts ISO + common formats)
- **Timezone:** 
  - **Teramind input** = **UTC-Eastern** (EDT if DST, EST if standard time)
  - **Conversion function:** `teramindToPanama()` converts Eastern → Panama time (UTC-5, no DST)
  - **Formula:** If DST in effect → subtract 1 hour; else no change
  - **Final storage:** As regular JavaScript Date objects in memory; **can be serialized to `timestamptz` for DB**

---

## C. ROSTER / SCHEDULES / NORMALIZATION — BLOCKING FOR JOINS

### 7. Roster & Schedule Data Sources
**Employee roster:** `public.employees` table

**Columns:**
```sql
• id                      : int8 (PRIMARY KEY)
• display_name            : text (full name)
• teramind_email          : text (canonical identifier for Teramind matching)
• company_domain          : text (company email domain, if applicable)
• schedule_id             : int8 (FK → schedules.id)
• is_grace_list           : bool (special time-allow list)
• is_macbook_swap         : bool (MacBook-specific rules)
• excluded_from_payroll   : bool
• active                  : bool (current employment status)
• start_date              : date (hire date)
• end_date                : date (termination date)
• notes                   : text
```

**Shift Times:** Stored in `public.schedules` (joined via `schedule_id`)
```sql
• schedule_name           : text
• standard_start          : text (e.g., "8:00 AM")
• standard_end            : text (e.g., "5:00 PM")
• dst_start               : text (daylight saving override start, if any)
• dst_end                 : text (daylight saving override end, if any)
• grace_minutes           : int4 (late tolerance before marking YELLOW)
```

**Manager/company:** NOT stored in DB — Teramind or Monday boards only.

### 8. Email Normalization & Alias Table
**✓ Alias table EXISTS:** `public.name_aliases`
```sql
• id                      : int8
• alias_text              : text (alternate name/email variant)
• employee_id             : int8 (FK → employees.id)
```

**Use case:** Allows mapping Teramind identifiers (e.g., "john.smith@macbook", typos, old emails) to canonical `employees.teramind_email`.

**Normalization function:** `normalizeName(input)` → lowercase + trim + simple punctuation removal for fuzzy matching.

### 9. Active vs. Off-boarded Status
**Tracking:**
- `employees.active` : `bool` — TRUE if currently employed
- `employees.end_date` : `date` — populated when off-boarded
- `excluded_from_payroll` : `bool` — legacy flag (not used in current classification)

**In queries:** Filter by `WHERE active = true` and `end_date IS NULL` (or `end_date > period_start`).

---

## D. MONDAY.COM JOINS — BLOCKING FOR GAF/PERMISSIONS

### 10. Monday Board IDs & Column IDs
**Configuration stored in:** `public.classification_config` (key-value table)

**Board IDs (defaults; may be overridden in config):**
```
monday_board_attendance   = 9542698245
monday_board_adjustments  = 18394647909
monday_board_permissions  = 18394590373
```

**Column IDs (Attendance Board 9542698245):**
```
monday_col_attendance_email    = "email_mkzjpqgt"
monday_col_attendance_date     = "date0d5ep965"
monday_col_attendance_type     = "single_selectjxb85m6"  (values: "Absence", "Tardiness")
monday_col_attendance_reason   = "color_mksnwwxd"
```

**Column IDs (Permissions Board 18394590373):**
```
monday_col_permissions_email       = "email_mkzjqdh7"
monday_col_permissions_daterange   = "date_rangeye9vcz9z"  (from/to dates)
monday_col_permissions_type        = "single_selectogxov2i"
monday_col_permissions_type_alt    = "single_select889imtb"  (fallback if primary empty)
```

**Column IDs (Adjustments Board 18394647909):**
```
monday_col_adjustments_email   = "email_mkzjtb9v"
monday_col_adjustments_date    = "date_mkzk6a5a"
monday_col_adjustments_type    = "single_selectnisb6ij"
```

### 11. Live Monday Data in SQL Views?
**✗ NOT DIRECTLY.** Monday data cannot be joined live in a SQL view.

**Why:** Monday.com API is accessed via GraphQL HTTP action (`pullMondayBoard`), not a direct DB connection. SQL views can only reference tables/materialized views.

**Architecture:** Monday data is **fetched and synced** during the **Process Payroll run**:
1. `pullMondayBoard()` GraphQL action fetches all items from each board
2. Data is **not persisted to DB** — stored in-memory during run
3. Attendance/permission data is **merged into `payroll_entries`** during classification
4. **Snapshots are saved** as JSON in `run_snapshots` for audit

**If you need live Monday data in a view:** You would need to:
- Either create a sync process (scheduled job outside the UI) to replicate Monday boards to a DB table
- Or use a materialized view that calls a `REFRESH` trigger after each run

**Current state:** No such sync is running. Monday data is **point-in-time at run**, not live.

### 12. Permissions Board Email Column
**✗ CONFIRMED: No email column.**

The Permissions board stores:
- **Name only** (item name field)
- Date range (start/end)
- Request type (e.g., "PTO", "Permiso Remunerado")

**Email must be obtained by:**
1. Matching the Monday **item name** against `employees.display_name`
2. Or matching against `name_aliases.alias_text`
3. Fallback: search by normalized name

This is a **name→email join challenge** already solved in `rowMatchesEmp()` helper in `classificationEngine.ts`.

---

## E. APP INTEGRATION

### 13. New Page vs. Embedded
**Recommendation:** Create a **NEW PAGE** (not embedded).

**Existing pages** (by priority):
- `/summary` — Dashboard (high-level KPIs, summary by employee)
- `/process` — Payroll processing (upload Teramind + pull Monday)
- `/action-required` — RED/YELLOW items needing resolution
- `/payroll-master` — Full entry grid with editing
- `/period-log` — Historical periods
- `/admin/*` — Configuration (employees, schedules, holidays, etc.)

**New attendance dashboard** could live at:
- `/attendance` or `/live-attendance` — real-time/recent view
- OR as a tab within `/summary` dashboard

**Route structure (in `app/app.tsx`):**
```tsx
<Route path="/attendance" element={<LiveAttendanceDashboard />} />
```

**Navigation:** Add to TopNav alongside Process, Action Required, etc.

### 14. Row-Level Security
**Current implementation:** **NO row-level security enforced in DB queries.**

- All admins see **all employees** across all periods
- User role (`{{ user.role }}`) is available for SQL actions but **not used** for filtering
- App assumes **all authenticated users are trusted admins**

**If you need per-team/per-manager views:** You would need to:
- Store `manager_id` in `employees` table
- Filter queries with `WHERE employee.manager_id = {{ user.id }}` (requires `user.id` in context)
- Enforce in SQL actions (safe) or UI logic (unsafe)

### 15. Charting Library
**✓ Recharts v2.12.7** is already installed in `package.json`.

**Examples already in codebase:**
- Progress bar (line chart progress)
- Status badges (colored chips)

**Recharts components available:**
```typescript
// Examples for attendance dashboard:
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
```

**Sample data format for Recharts:**
```javascript
const data = [
  { date: '2026-04-11', on_time: 45, late: 12, absent: 3 },
  { date: '2026-04-12', on_time: 48, late: 8, absent: 2 },
  // ...
];
<LineChart data={data}>
  <Line type="monotone" dataKey="on_time" stroke="#22c55e" />
  <Line type="monotone" dataKey="late" stroke="#eab308" />
  <Line type="monotone" dataKey="absent" stroke="#ef4444" />
</LineChart>
```

---

## SQL VIEW RECOMMENDATION

Since Monday data can't be joined live in SQL, the view should:

1. **Join `payroll_entries` with live employee/schedule data** to compute attendance classification
2. **Assume Monday data is already merged into `payroll_entries.event_type_1/event_type_2`** during the Process Payroll run
3. **Aggregate by employee/date/period** for dashboard queries

**Example structure:**
```sql
CREATE VIEW v_attendance_live AS
SELECT
  pe.work_date,
  e.display_name,
  e.teramind_email,
  pe.entry_time,
  pe.exit_time,
  s.standard_start,
  s.scheduled_end,
  pe.late_minutes,
  pe.event_type_1,
  pe.initial_status,
  pe.payroll_ready
FROM payroll_entries pe
JOIN employees e ON e.id = pe.employee_id
LEFT JOIN schedules s ON e.schedule_id = s.id
WHERE pe.period_name = (SELECT period_name FROM periods ORDER BY start_date DESC LIMIT 1)
  AND e.active = true
ORDER BY e.display_name, pe.work_date;
```

---

## QUICK REFERENCE — COLUMN MAPPING

| **Concept** | **Table** | **Column** | **Type** |
|---|---|---|---|
| Employee ID | `employees` | `id` | int8 |
| Employee Name | `employees` | `display_name` | text |
| Teramind Identity | `employees` | `teramind_email` | text |
| Shift Times | `schedules` | `standard_start`, `standard_end` | text |
| Grace Period | `schedules` | `grace_minutes` | int4 |
| Work Date | `payroll_entries` | `work_date` | text (format: "YYYY-MM-DD (Day)") |
| Entry Time | `payroll_entries` | `entry_time` | text (format: "H:MM AM/PM") |
| Exit Time | `payroll_entries` | `exit_time` | text (format: "H:MM AM/PM") |
| Status | `payroll_entries` | `initial_status` | text ("GREEN", "YELLOW", "RED") |
| Current Status | `payroll_entries` | `status_current` | text (status after operator resolution) |
| Payroll Ready | `payroll_entries` | `payroll_ready` | text ("YES", "NO") |
| Period Name | `payroll_entries` | `period_name` | text |
| Event Type 1 | `payroll_entries` | `event_type_1` | text (e.g., "Tardanza", "PTO", "Ausencia") |
| Pay Impact | `payroll_entries` | `pay_impact_1` | text |
| Notes | `payroll_entries` | `notes` | text (operator notes) |
| Auto Notes | `payroll_entries` | `auto_notes` | text (system-generated) |

---

## BUILD CHECKLIST FOR ENGINEER

- [ ] **A.1** Confirm PostgreSQL version supports `AT TIME ZONE`
- [ ] **A.2** Confirm `public` schema is writable (CREATE VIEW permission)
- [ ] **B.3-B.7** Understand Teramind data is **in-memory during run, not persistent** (use `run_snapshots` for audit)
- [ ] **C.7-C.9** Join `employees` + `name_aliases` + `schedules` on `teramind_email` and normalized names
- [ ] **D.10-D.12** Hard-code or fetch Monday board/column IDs from `classification_config`; no live SQL join (requires sync)
- [ ] **D.13** Permissions board join by **name only** — implement name→email matching
- [ ] **E.13** Use **Recharts** for trends/KPIs
- [ ] **E.14** Create new `/attendance` page (or embed in `/summary`)
- [ ] **E.15** No RLS needed; all admins see all data
- [ ] Build view to query `payroll_entries` + joins; assume Monday data already merged
