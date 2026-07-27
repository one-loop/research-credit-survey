-- Add title column to papers table if it does not already exist.
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS title text;
