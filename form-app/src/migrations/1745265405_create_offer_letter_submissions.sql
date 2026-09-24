-- Migration: create offer_letter_submissions table
CREATE TABLE offer_letter_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_name TEXT NOT NULL,
  pay_rate TEXT NOT NULL,
  date_of_signing DATE NOT NULL,
  signature_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed sample data
INSERT INTO offer_letter_submissions (employee_name, pay_rate, date_of_signing, signature_base64)
VALUES
  ('Maria Johnson', '13.50/hr', '2026-01-15', ''),
  ('David Williams', '12.75/hr', '2026-02-20', ''),
  ('Angela Carter', '14.00/hr', '2026-03-10', '');
