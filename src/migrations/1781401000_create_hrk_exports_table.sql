-- Migration: create hrk_exports table to store exported HRK summaries per period
CREATE TABLE public.hrk_exports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_name TEXT NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_by TEXT,
  summary_json TEXT NOT NULL
);

CREATE INDEX idx_hrk_exports_period_name ON public.hrk_exports (period_name);
