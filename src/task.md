# Attendance Dashboard Build

## Key findings from diagnostics
- schedules: all use 9:00 AM start (not 8:00 AM — update view default)
- initial_status: GREEN=1381, YELLOW=738, RED=21 — healthy denominator
- status_current: ALL "GREEN" — use initial_status for display, not status_current
- event_type_1 real values: "" (on-time/no event), Tardanza, Feriado, Salida Temprano, PTO, Ausencia Justificada., Permiso Remunerado, Ausencia Injustificada, Permiso No remunerado
- 5 periods: Q2-Mar-2026, Q1-Apr-2026, Q2-Apr-2026, Q1-May-2026, Q2-May-2026
- entry_time format: "8:03 AM" (12h), standard_start: "9:00 AM" (same tz — confirmed)

## Subtasks
- [x] Run Step-0 diagnostics
- [x] Create DB migration with v_attendance_daily view (corrected mapping arrays + 9:00 AM default)
- [x] Create action: loadAttendanceView (with date range + employee filter params)
- [x] Create action: loadAttendanceEmployees (employees + schedules join)
- [x] Create page: app/pages/Attendance.tsx
  - Section 1: Filter bar (date range, quick presets, employee search)
  - Section 2: KPI row (On-Time Rate, Late Reported, Late Unreported, Excused, Permission, Avg Min Late, Days Tracked)
  - Section 3: Dashboard tab — 3 donut charts (Attendance Overview, Late by Window, Reporting Compliance)
  - Section 4: Employees tab — sortable table with all v9.6 columns
  - Section 5: Employee slide panel (per-employee bar charts)
  - Section 6: Trends tab (line chart, delta readout, period table)
- [x] Register route /attendance in app.tsx + add TopNav item
