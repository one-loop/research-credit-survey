-- Redefine get_experiment_papers to replace the prior TABLESAMPLE SYSTEM (1)
-- approach, which was causing multi-second latency on large tables.
-- This version returns deterministic-but-varied papers by using
-- indexed columns (work_exposure, created_at) for ordering instead of sampling.

CREATE OR REPLACE FUNCTION get_experiment_papers(author_id text, works_per int DEFAULT 5)
RETURNS SETOF papers
LANGUAGE plpgsql
AS $$
DECLARE
  own_rec   papers%ROWTYPE;
  field_val text;
  remaining int := works_per;
BEGIN
  IF works_per IS NULL OR works_per <= 0 THEN
    RETURN;
  END IF;

  -- 1. Try to find the respondent's own paper by author_id in authors JSONB.
  IF author_id IS NOT NULL THEN
    SELECT *
    INTO own_rec
    FROM papers
    WHERE authors @> jsonb_build_array(jsonb_build_object('author_id', author_id))
    ORDER BY work_exposure NULLS FIRST, created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN NEXT own_rec;
      field_val := own_rec.field;
      remaining := works_per - 1;
    END IF;
  END IF;

  IF remaining <= 0 THEN
    RETURN;
  END IF;

  -- 2. If we know the field from the own paper, choose same-field under-cap papers.
  IF field_val IS NOT NULL THEN
    RETURN QUERY
    SELECT p.*
    FROM papers p
    WHERE p.field = field_val
      AND (own_rec.work_id IS NULL OR p.work_id <> own_rec.work_id)
      AND (p.work_exposure IS NULL OR p.work_exposure < 3)
    -- Prefer papers with lower exposure and newer created_at
    ORDER BY p.work_exposure NULLS FIRST, p.created_at DESC
    LIMIT remaining;
  ELSE
    -- 3. Otherwise, choose under-cap papers globally.
    RETURN QUERY
    SELECT p.*
    FROM papers p
    WHERE p.work_exposure IS NULL OR p.work_exposure < 3
    ORDER BY p.work_exposure NULLS FIRST, p.created_at DESC
    LIMIT remaining;
  END IF;
END;
$$;

-- Indexes to support get_experiment_papers ordering without explicit sorts.
-- Same-field branch: filter on field and under-cap exposure, order by (work_exposure, created_at DESC).
CREATE INDEX IF NOT EXISTS idx_papers_field_work_exposure_created_at
  ON papers (field, work_exposure, created_at DESC)
  WHERE (work_exposure IS NULL OR work_exposure < 3);

-- Global branch: under-cap exposure only, same ordering.
CREATE INDEX IF NOT EXISTS idx_papers_work_exposure_created_at
  ON papers (work_exposure, created_at DESC)
  WHERE (work_exposure IS NULL OR work_exposure < 3);
