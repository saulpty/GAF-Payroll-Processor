-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781402200_create_pto_tables
-- name:         create pto tables
-- applied_at:   2026-07-22 18:08:08
-- applied_by:   system
-- checksum:     079b150c71c01daf781f3e96059a1948da7de667906feef8ad4736fcea25cb74
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Migration: Create PTO Tracker tables (pto_employees, pto_approvals, pto_floating_holidays)

-- PTO employee metadata (paid cap, links to employees table)
CREATE TABLE IF NOT EXISTS pto_employees (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  paid_pto_cap INT NOT NULL DEFAULT 15,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pto_employees_employee_id_unique UNIQUE (employee_id)
);

CREATE INDEX idx_pto_employees_employee_id ON pto_employees (employee_id);

-- PTO approval log (leave requests)
CREATE TABLE IF NOT EXISTS pto_approvals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_on DATE NOT NULL,
  return_on DATE NOT NULL,
  total_days INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved',
  gaf_comments TEXT,
  submitted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pto_approvals_employee_id ON pto_approvals (employee_id);
CREATE INDEX idx_pto_approvals_leave_on ON pto_approvals (leave_on);

-- Floating holiday tracker (2 per year, resets Jan 1, eligible after 90 days)
CREATE TABLE IF NOT EXISTS pto_floating_holidays (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  calendar_year INT NOT NULL,
  fh_allocated INT NOT NULL DEFAULT 2,
  fh_used INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pto_fh_employee_year_unique UNIQUE (employee_id, calendar_year)
);

CREATE INDEX idx_pto_fh_employee_id ON pto_floating_holidays (employee_id);