-- Speeds up institution autocomplete for ILIKE '%query%' searches.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'institutions'
      AND column_name = 'display_name'
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_institutions_display_name_trgm
      ON public.institutions
      USING GIN (display_name gin_trgm_ops)
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'institutions'
      AND column_name = 'display name'
  ) THEN
    EXECUTE '
      CREATE INDEX IF NOT EXISTS idx_institutions_display_name_spaced_trgm
      ON public.institutions
      USING GIN (\"display name\" gin_trgm_ops)
    ';
  END IF;
END $$;
