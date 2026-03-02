-- Run this in Supabase SQL Editor after adding the work_exposure column.
-- 1. Ensures work_exposure has a default and function for atomic increment
-- 2. Adds indexes to speed up queries

-- Ensure work_exposure column exists and defaults to 0
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS work_exposure INT DEFAULT 0;

-- Function to atomically increment work_exposure for multiple work_ids
CREATE OR REPLACE FUNCTION increment_work_exposure(work_ids text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE papers
  SET work_exposure = COALESCE(work_exposure, 0) + 1
  WHERE work_id = ANY(work_ids);
END;
$$;

-- Indexes for faster queries:
-- 1. GIN index on authors JSONB for containment queries (@> '{"author_id": "..."}')
CREATE INDEX IF NOT EXISTS idx_papers_authors_gin
  ON papers USING GIN (authors jsonb_path_ops);

-- 2. Composite index for "same field, under exposure cap" queries
CREATE INDEX IF NOT EXISTS idx_papers_field_exposure
  ON papers (field, work_exposure)
  WHERE work_exposure < 3 OR work_exposure IS NULL;

-- 3. Index on work_exposure for sample queries when no authorId
CREATE INDEX IF NOT EXISTS idx_papers_exposure
  ON papers (work_exposure, created_at)
  WHERE work_exposure < 3 OR work_exposure IS NULL;
