-- Flag papers where any author lacks contribution tags; exclude from study selection.
ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS contributions_complete boolean NOT NULL DEFAULT true;

UPDATE papers p
SET contributions_complete = false
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(COALESCE(p.authors, '[]'::jsonb)) AS author
  WHERE jsonb_array_length(COALESCE(author->'contributions', '[]'::jsonb)) = 0
);

CREATE INDEX IF NOT EXISTS idx_papers_contributions_complete_study
  ON papers (contributions_complete)
  WHERE contributions_complete = true;

-- Keep legacy RPC aligned with app-side pool filters.
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

  IF author_id IS NOT NULL THEN
    SELECT *
    INTO own_rec
    FROM papers
    WHERE contributions_complete = true
      AND authors @> jsonb_build_array(jsonb_build_object('author_id', author_id))
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

  IF field_val IS NOT NULL THEN
    RETURN QUERY
    SELECT p.*
    FROM papers p
    WHERE p.contributions_complete = true
      AND p.field = field_val
      AND (own_rec.work_id IS NULL OR p.work_id <> own_rec.work_id)
      AND (p.work_exposure IS NULL OR p.work_exposure < 3)
    ORDER BY p.work_exposure NULLS FIRST, p.created_at DESC
    LIMIT remaining;
  ELSE
    RETURN QUERY
    SELECT p.*
    FROM papers p
    WHERE p.contributions_complete = true
      AND (own_rec.work_id IS NULL OR p.work_id <> own_rec.work_id)
      AND (p.work_exposure IS NULL OR p.work_exposure < 3)
    ORDER BY p.work_exposure NULLS FIRST, p.created_at DESC
    LIMIT remaining;
  END IF;
END;
$$;
