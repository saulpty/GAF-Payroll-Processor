# Soft-Delete Payroll Entries + Period Log Deleted Items

[x] 1. Migration: add `deleted_at` and `deleted_by` to `payroll_entries`
[x] 2. Actions: `softDeletePayrollEntry`, `restorePayrollEntry`, `loadDeletedEntries`
[x] 3. Update `loadPayrollMaster` and `countPayrollMaster` to exclude deleted rows
[x] 4. PayrollMaster: add delete button per row + confirm dialog
[x] 5. PeriodLog: add "Deleted Items" collapsible section with restore button
