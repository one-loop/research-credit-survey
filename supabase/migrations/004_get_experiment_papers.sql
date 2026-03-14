-- RPC to get Experiment A papers in a single round trip.
-- Given an author_id and desired number of works, it:
-- 1. Finds that author's own paper (if any) and returns it first (ignoring work_exposure).
-- 2. Fills remaining slots with random papers from the same field with work_exposure < 3.
-- 3. If no own paper or no field is found, falls back to random under-cap papers.

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

  -- 2. If we know the field from the own paper, sample in-field under-cap papers.
  IF field_val IS NOT NULL THEN
    RETURN QUERY
    SELECT p.*
    FROM papers p TABLESAMPLE SYSTEM (1)
    WHERE p.field = field_val
      AND p.work_id <> own_rec.work_id
      AND (p.work_exposure IS NULL OR p.work_exposure < 3)
    LIMIT remaining;
  ELSE
    -- 3. Otherwise, just sample under-cap papers globally.
    RETURN QUERY
    SELECT p.*
    FROM papers p TABLESAMPLE SYSTEM (1)
    WHERE p.work_exposure IS NULL OR p.work_exposure < 3
    LIMIT remaining;
  END IF;
END;
$$;

