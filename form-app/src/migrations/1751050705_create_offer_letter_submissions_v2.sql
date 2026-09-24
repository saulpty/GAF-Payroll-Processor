-- Migration: create offer_letter_submissions table in GA Offer Letter DB v2
CREATE TABLE IF NOT EXISTS offer_letter_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_name TEXT NOT NULL,
  pay_rate TEXT NOT NULL,
  date_of_signing DATE NOT NULL,
  signature_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
