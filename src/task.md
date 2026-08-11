# Staging → Production Migration

## Migrations (new SQL files to add)
[ ] 1. Copy 20 new migration SQL files from staging to migrations/
[ ] 2. Verify applied.txt state — do NOT modify it

## New Actions (15 new action files)
[ ] 3. Add: fetchMondayStartDates, loadActionRequiredCounts, loadDeletedEntries
[ ] 4. Add: loadHrkExports, loadHrkSummary, renamePeriod, restorePayrollEntry
[ ] 5. Add: saveHrkExport, softDeletePayrollEntry, updateEmployeeRoleManager, updateEmployeeStartDate
[ ] 6. Update: loadPayrollMaster, countPayrollMaster (exclude deleted), upsertPayrollEntries, upsertPeriod, upsertSchedule

## New App Files
[ ] 7. Add: app/context/GlobalFilterContext.tsx
[ ] 8. Add: app/FilterBar.tsx
[ ] 9. Add: app/components/TimeInput.tsx
[ ] 10. Add: app/pages/HrkSummary.tsx

## Updated App Files
[ ] 11. Update: app/app.tsx (routes + GlobalFilterProvider + FilterBar)
[ ] 12. Update: app/TopNav.tsx (new two-tier nav)
[ ] 13. Update: app/pages/ProcessPayroll.tsx (work_days support)
[ ] 14. Update: app/pages/ActionRequired.tsx (global filters, TimeInput, RotateCcw)
[ ] 15. Update: app/pages/PayrollMaster.tsx (global filters, soft delete, undo, bulk edit)
[ ] 16. Update: app/pages/SummaryDashboard.tsx (global filter integration)
[ ] 17. Update: app/pages/PeriodLog.tsx (rename, HRK history, deleted items recovery)
[ ] 18. Update: app/pages/Attendance.tsx (global filter integration)
[ ] 19. Update: app/pages/admin/AdminEmployees.tsx (role/manager fields)
[ ] 20. Update: app/pages/admin/AdminEmployeeSync.tsx (role/manager/start date sync)
[ ] 21. Update: app/pages/admin/AdminSchedules.tsx (work_days picker, upsertSchedule)
[ ] 22. Update: app/pages/admin/AdminLayout.tsx
[ ] 23. Delete: app/pages/admin/AdminGraceList.tsx, AdminMacbookSwap.tsx (consolidated)
[ ] 24. Lint and fix
