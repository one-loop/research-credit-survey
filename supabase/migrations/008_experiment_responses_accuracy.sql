-- Per-queue accuracy (0–1) and per-work breakdown, set at submission time.
ALTER TABLE experiment_responses
  ADD COLUMN IF NOT EXISTS average_accuracy double precision,
  ADD COLUMN IF NOT EXISTS work_accuracies jsonb;

CREATE INDEX IF NOT EXISTS idx_experiment_responses_author_experiment
  ON experiment_responses (author_id, experiment_type);
