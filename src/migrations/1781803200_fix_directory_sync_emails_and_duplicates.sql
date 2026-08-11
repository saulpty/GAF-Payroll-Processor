-- Fix email corrections from Monday text_mkzjgsxv column and remove gmail duplicates

-- 1. Fix Eder Quintero: update to correct company email
UPDATE employees
SET teramind_email = 'eder.q@vitasyahc.com',
    company_domain = 'vitasyahc.com',
    notes = COALESCE(notes, '') || ' [email corrected from Monday directory]'
WHERE id = 43;

-- 2. Fix Jean Pierre Montfort: update to correct company email
UPDATE employees
SET teramind_email = 'jp.m@mombaaz.com',
    company_domain = 'mombaaz.com',
    notes = COALESCE(notes, '') || ' [email corrected from Monday directory]'
WHERE id = 45;

-- 3. Fix Cemiriamiz Iglesias: update to correct company email
UPDATE employees
SET teramind_email = 'cemi.i@mombaoh.com',
    company_domain = 'mombaoh.com',
    notes = COALESCE(notes, '') || ' [email corrected from Monday directory]'
WHERE id = 46;

-- 4. Remove all FK-referencing rows for the two gmail duplicates before deleting them
--    ids: 44 = Isaac Chung (gmail), 53 = Johann Morante (gmail)

DELETE FROM name_aliases           WHERE employee_id IN (44, 53);
DELETE FROM payroll_entries        WHERE employee_id IN (44, 53);
DELETE FROM pto_employees          WHERE employee_id IN (44, 53);
DELETE FROM pto_approvals          WHERE employee_id IN (44, 53);
DELETE FROM pto_floating_holidays  WHERE employee_id IN (44, 53);

-- 5. Now safe to delete the duplicate employee rows
DELETE FROM employees WHERE id IN (44, 53);
