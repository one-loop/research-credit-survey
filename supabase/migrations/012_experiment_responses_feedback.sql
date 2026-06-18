-- Optional free-text feedback from respondents on the thank-you screen (per submission).
ALTER TABLE experiment_responses
  ADD COLUMN IF NOT EXISTS feedback text;
