-- Add event_type_rules table for mapping event types to their default pay impacts
CREATE TABLE event_type_rules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type TEXT NOT NULL,
  default_pay_impact TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_event_type_rules_event_type ON event_type_rules (event_type);
