# Nav + Shared Filter Revamp

## Tasks

- [x] Create `app/context/GlobalFilterContext.tsx` — period, dateFrom, dateTo, employee, role, manager
- [x] Rewrite `app/TopNav.tsx` — 3 grouped dropdown menus (Payroll, Attendance, Admin)
- [x] Create `app/FilterBar.tsx` — route-aware shared filter strip below nav
- [x] Update `app/app.tsx` — wrap in GlobalFilterProvider, add FilterBar
- [x] Update `app/pages/SummaryDashboard.tsx` — read period from context
- [x] Update `app/pages/ActionRequired.tsx` — read period from context
- [x] Update `app/pages/PayrollMaster.tsx` — read period + employee from context
- [x] Update `app/pages/HrkSummary.tsx` — read period from context
- [x] Update `app/pages/Attendance.tsx` — read dateFrom/dateTo/manager/role/employee from context
