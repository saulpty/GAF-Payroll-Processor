# Requirements

## Summary
GAF Planilla is a payroll processing application for GAF Healthcare Services (Panama), managing ~41 employees across two pay periods per month ("quincenas"). The app replaces a manual Excel-based workflow by holding all historical payroll data in a hosted PostgreSQL database, pulling attendance data from Monday.com boards, accepting manual Teramind CSV/XLSX uploads, and running a classification engine that auto-tags each employee×workday row as GREEN (resolved), YELLOW (verify), or RED (must resolve). Tim (the operator) reviews only flagged items, resolves them inline, and produces period summaries and exports.

## Use cases

- **App Shell & Database Setup** ✅
  1. Create database schema with all required tables: employees, schedules, dst_calendar, holidays, name_aliases, payroll_entries, periods, run_snapshots, event_types, pay_impacts, documentation_options
  2. Seed all tables with migration data from the CSV package (employees, schedules, holidays, dst_calendar, name_mapping/aliases, periods, lookup values)
  3. Seed payroll_entries with all 2,140 historical rows across 5 pay periods
  4. Build multi-page shell with sidebar navigation: Process Payroll, Action Required, Payroll Master, Summary Dashboard, Admin, Period Log

- **Process Payroll**
  1. User fills out period form: Period Name, Start Date, End Date
  2. User uploads Teramind export (CSV or XLSX); toggles "Mid-day pull" (assign 4:00 PM default exit) and inputs outage dates (all employees get default GREEN rows on those dates)
  3. User selects per-run employee exclusions from a multi-select employee picker
  4. App runs pre-flight name-resolution check: unresolvable Monday/Teramind names block run and prompt user to map them permanently to name_aliases
  5. User clicks "Pull Monday Data & Run" — app fetches the 3 Monday boards (GAF Attendance, Time Adjustments, Permissions & Requests), parses Teramind upload, runs the classification engine, writes payroll_entries, and saves a run_snapshot
  6. Results summary is shown: X GREEN / Y YELLOW / Z RED; warn before re-processing an existing period

- **Action Required**
  1. User selects a pay period from a dropdown
  2. RED rows displayed at top, YELLOW below (filtered to payroll_ready = NO), color-coded
  3. User edits Pay Impact 1/2, Documentation, Notes inline per row
  4. On save, derived fields recompute (discount_total_minutes, payroll_ready, status_current); resolved rows turn GREEN and drop off the list

- **Payroll Master**
  1. User views the full historical payroll table filterable by period, employee, and status
  2. Rows are color-coded: GREEN #C6EFCE, YELLOW #FFEB9C, RED #FFC7CE by status_current
  3. All 23 Planilla columns displayed in canonical order (Period, Employee, Date, Entry, Exit, Scheduled Start, Grace Until, Scheduled End, Late Minutes, Late Min after Grace, Early Leave Minutes, Discount Total, Payroll Ready, Event Type 1, Pay Impact 1, Event Type 2, Pay Impact 2, Documentation, Notes, Status, Auto-Notes, Initial Status)

- **Summary Dashboard**
  1. User selects a date range or pay period
  2. Per-employee stats shown: days in period, days worked, absences, late days, early-leave days, total discount minutes/hours, PTO/holiday/permission days, RED/YELLOW counts, all-ready indicator
  3. Discount breakdown by reason: Tardanza, Salida Temprano, Permiso No Remunerado, Constancia Médica, Ausencia Injustificada — compared against 104-hr base

- **Admin**
  1. CRUD for employees (with active/inactive toggle, schedule assignment, grace-list flag, Macbook-swap flag)
  2. Dedicated Grace List screen: add/remove employees from the grace list
  3. Dedicated Macbook-Swap List screen: add/remove employees
  4. Name aliases management: add/edit/delete alias_text → employee mappings
  5. Schedules CRUD: start/end times per DST/standard, grace minutes
  6. Holidays CRUD: date + name
  7. DST Calendar CRUD: year, US DST start, US DST end
  8. Lookup tables CRUD: event_types, pay_impacts, documentation_options

- **Period Log**
  1. Table of all processed runs: period name, date range, processed date, employee count, days, GREEN/YELLOW/RED counts, notes
  2. Clicking a period navigates to the Payroll Master filtered to that period

## Plan

### App Shell & Database Setup
1. [x] Create migration SQL to create all tables: `schedules`, `dst_calendar`, `holidays`, `employees`, `name_aliases`, `event_types`, `pay_impacts`, `documentation_options`, `periods`, `run_snapshots`, `payroll_entries` with all columns matching the spec (Section 4 of handoff doc)
2. [x] In the same migration, seed `schedules` with 3 rows (Standard, Monique Luque, Favian Fortune) and `dst_calendar` with 3 rows (2025–2027)
3. [x] Seed `holidays` with all 11 Panama 2026 holidays
4. [x] Seed `employees` with all 41 employees including teramind_email, company_domain, schedule reference, is_grace_list, is_macbook_swap flags
5. [x] Seed `name_aliases` with the 8 known aliases (Ozzy Medina, Gisselle variants, Iittami variants, Diana, Alanis, Angela Rodgers, Lilian Barria)
6. [x] Seed `event_types`, `pay_impacts`, `documentation_options` lookup tables with all values from Section 7.3
7. [x] Seed `periods` with the 5 historical quincenas
8. [x] Seed `payroll_entries` with all 2,140 historical rows (period, employee, date, entry, exit, all computed columns, initial_status, status_current)
9. [x] Build the app shell: sidebar navigation with icons for Process Payroll, Action Required, Payroll Master, Summary Dashboard, Admin (expandable sub-items), Period Log; render a placeholder for each page

### Process Payroll
1. [x] Build the Process Payroll page form: Period Name text input, Start Date picker, End Date picker, Teramind file upload (CSV/XLSX), "Mid-day pull" toggle, Outage Dates multi-date input, Employee Exclusions multi-select from employees table
2. [x] On Teramind file upload: parse CSV/XLSX in-browser, group rows by email + date, compute entry (earliest Time Started) and exit (latest Time Finished) per employee per day, apply timezone conversion using dst_calendar (US Eastern → Panama UTC-5: subtract 1 hr during DST, no change during standard time)
3. [x] Build "Pull Monday Data & Run" button: query Monday.com API v2 GraphQL for all 3 boards filtered to the period date range — GAF Attendance (tardiness/absence), Time Adjustments (TFT/late payback), Permissions & Requests (PTO, floating holiday, comp day, birthday, TFT-days, WFH); store raw snapshot to run_snapshots
4. [x] Build name-resolution pre-flight: resolve Teramind emails via employees.teramind_email; resolve Monday board names via employees.display_name + name_aliases (case/accent-insensitive); collect all unresolved names; if any, block run and show a mapping dialog that saves new aliases permanently
5. [x] Implement the classification engine as a JS/TS function operating on the merged data: process each active employee × each workday in the period applying the 7 steps in priority order (Holiday → Full-day permission → Absence form → Macbook-swap → No data → WFH → Normal day with tardiness/early-leave logic) with grace-list logic, discount calculation per Section 6.3, and payroll_ready/status_current derived fields per Section 6.4
6. [x] On engine completion: upsert payroll_entries rows to DB (warn + confirm before overwriting existing period rows); display results summary card (X GREEN / Y YELLOW / Z RED) with a link to Action Required

### Action Required
1. [x] Build the Action Required page: period selector dropdown at top; fetch payroll_entries where initial_status IN ('RED','YELLOW') AND payroll_ready = 'NO' for selected period; display RED section first, then YELLOW; row background colors per spec (#FFC7CE red, #FFEB9C yellow)
2. [x] Render each row with inline-editable cells: Pay Impact 1 (dropdown from pay_impacts), Pay Impact 2 (dropdown), Documentation (dropdown), Notes (text); all other fields read-only
3. [x] On save/blur of any editable field: recompute discount_total_minutes per Section 6.3 formula, then recompute payroll_ready and status_current per Section 6.4; update row in DB; if now resolved (payroll_ready = YES), remove row from the list and show a success toast
4. [x] Show a counter badge in the sidebar Action Required link with total unresolved count across all periods

### Payroll Master
1. [x] Build the Payroll Master page: filter bar with Period (dropdown of all period names), Employee (searchable dropdown), Status (GREEN/YELLOW/RED multi-select); paginated data table
2. [x] Display all 23 columns in canonical Planilla order; apply row background color by status_current (#C6EFCE green, #FFEB9C yellow, #FFC7CE red); format times as 12-hour (8:00 AM), dates as YYYY-MM-DD (Day)
3. [x] Add "Export to Excel" button: generate an XLSX file with all filtered rows in canonical column order, row colors, 12-hr time and date formats, computed values (no formulas)

### Summary Dashboard
1. [x] Build Summary Dashboard page: period/date-range selector; query payroll_entries and aggregate per employee: days in period, days worked (entry not null), absences (Ausencia rows), late days (Tardanza rows), early-leave days (Salida Temprano rows), total discount minutes/hours, PTO days, holiday days, permission days, RED count, YELLOW count, all-ready indicator
2. [x] Render per-employee summary table with all columns; add a totals/averages footer row
3. [x] Render a discount-by-reason breakdown table: columns Tardanza, Salida Temprano, Permiso No Remunerado, Constancia Médica, Ausencia Injustificada (minutes and hours), each row = one employee; compare discount hours to 104-hr base and show a variance column

### Admin
1. [x] Build Employee admin sub-page: data table of all employees with columns (display_name, teramind_email, company_domain, schedule, is_grace_list, is_macbook_swap, active, start_date, end_date); inline add/edit/delete with form validation; toggle active status
2. [x] Build Grace List dedicated screen: shows only employees where is_grace_list = true; buttons to add employees (searchable picker from active employees) and remove; changes update employees.is_grace_list
3. [x] Build Macbook-Swap List dedicated screen: same pattern as Grace List but for is_macbook_swap flag
4. [x] Build Name Aliases sub-page: table of alias_text → employee_id (display as display_name); add/edit/delete; employee picker uses searchable dropdown; accent/case-insensitive matching note displayed
5. [x] Build Schedules sub-page: table showing schedule_name, dst_start, dst_end, standard_start, standard_end, grace_minutes, notes; add/edit/delete with time pickers
6. [x] Build Holidays sub-page: table of date + name; add/edit/delete with date picker
7. [x] Build DST Calendar sub-page: table of year, us_dst_start, us_dst_end; add/edit/delete
8. [x] Build Lookup Tables sub-page: three editable lists side-by-side — Event Types, Pay Impacts, Documentation Options; each list supports add/edit/delete/reorder

### Period Log
1. [x] Build Period Log page: table showing all periods (period_name, date range, processed_date, employees, days, green count, yellow count, red count, notes); sorted by processed_date desc
2. [x] Make each period row clickable: navigate to Payroll Master pre-filtered to that period
