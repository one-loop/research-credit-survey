-- Generated author count for stratified survey pool queries (one work per bin).
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS author_count int
  GENERATED ALWAYS AS (jsonb_array_length(COALESCE(authors, '[]'::jsonb))) STORED;

CREATE INDEX IF NOT EXISTS idx_papers_study_pool_author_count
  ON papers (journal, domain, author_count, work_exposure, work_id)
  WHERE contributions_complete = true;
