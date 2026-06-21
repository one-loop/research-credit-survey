-- Beliefs collected once before the respondent's first block of ranking tasks.
-- credit_role_position_beliefs: { "<credit_role_id>": "first" | "middle" | "last", ... }
-- author_position_beliefs: { "younger": "first" | "last", "pi": "first" | "last" }
ALTER TABLE experiment_responses
  ADD COLUMN IF NOT EXISTS credit_role_position_beliefs jsonb;

ALTER TABLE experiment_responses
  ADD COLUMN IF NOT EXISTS author_position_beliefs jsonb;
