-- Add consent_status column to experiment_responses for IRB compliance
ALTER TABLE experiment_responses
  ADD COLUMN IF NOT EXISTS consent_status text DEFAULT 'pending';

-- Create an index to query by consent_status
CREATE INDEX IF NOT EXISTS idx_experiment_responses_consent_status
  ON experiment_responses (consent_status);
