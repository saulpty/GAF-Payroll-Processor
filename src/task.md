# Task Plan

## 1. Move "Sync Hire Dates" to AdminEmployeeSync page
[x] Add fetchMondayStartDates + updateEmployeeStartDate to AdminEmployeeSync
[x] Add hire date column to parseMondayDirectory output
[x] Add "Sync Hire Dates" section alongside existing sync UI
[x] Remove Sync Hire Dates button from HrkSummary page

## 2. PayrollMaster: multi-select + bulk edit with confirmation popup + undo
[x] Add checkbox column to PayrollMaster table
[x] Add "select all filtered" checkbox in header
[x] Bulk edit toolbar when rows selected (event1, impact1, event2, impact2, notes)
[x] Confirmation popup showing summary of changes before saving
[x] Undo last bulk save

## 3. Fix "Permiso No remunerado" + Unpaid discount not applying for Winston Carrillo
[x] Inspect computeDiscount — "Permiso No remunerado" with pay_impact Unpaid is not a Tardanza/Salida Temprano so discount=0
[x] Fix computeDiscount to handle full-day unpaid events (Permiso No remunerado, Ausencia Injustificada etc.) → use full_day_absence_discount_minutes
