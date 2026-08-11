-- RECOVERED FROM THE DATABASE — ALREADY APPLIED. DO NOT RE-RUN.
--
-- migration_id: 1781402300_deactivate_personal_email_duplicates
-- name:         deactivate personal email duplicates
-- applied_at:   2026-08-06 19:10:23
-- applied_by:   system
-- checksum:     f9a586c723dc94578c8e72d5ec4acd02dab80c7184057750c2e55a82244718b9
--
-- This migration ran against GAF Planilla DB but has no file in the UI
-- Bakery project. Recovered 2026-08-11 from the uib_migrations table so the
-- schema's history is not lost. It is a record, not a migration to execute.

-- Deactivate duplicate employee rows that were created with personal email addresses.
-- These employees already have correct work-email rows (ids 48, 49, 50+).
-- id 44 = Isaac Chung (isaac22chung@gmail.com) — work row is id 48 (isaac.c@vitasyahc.com)
-- id 45 = Jean Pierre Montfort (pierre_2207@hotmail.com) — personal only, kept but deactivated
-- id 46 = Cemiriamiz Iglesias (iglesias.cs17@gmail.com) — personal only, kept but deactivated
-- id 47 = Euclides Gonzalez (javierqvistgaard@hotmail.com) — work row is id 49 (javier.g@passiontocarehc.com)
UPDATE employees
SET active = false, notes = COALESCE(NULLIF(notes,''), '') || ' [DUPLICATE - personal email, deactivated]'
WHERE id IN (44, 45, 46, 47)
  AND active = true;