-- Migration: add pdf_en_base64 and pdf_es_base64 columns to disciplinary_actions
ALTER TABLE disciplinary_actions
  ADD COLUMN IF NOT EXISTS pdf_en_base64 TEXT,
  ADD COLUMN IF NOT EXISTS pdf_es_base64 TEXT;
