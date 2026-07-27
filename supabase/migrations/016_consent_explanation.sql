-- Add consent_explanation column to experiment_responses for optional consent feedback/explanation
ALTER TABLE experiment_responses
  ADD COLUMN IF NOT EXISTS consent_explanation text;

-- Create an index for responses with consent explanations
CREATE INDEX IF NOT EXISTS idx_experiment_responses_consent_explanation
  ON experiment_responses (consent_explanation)
  WHERE consent_explanation IS NOT NULL;
