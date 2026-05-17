-- Queue / batch number for each submission (0 = first batch of 5 tasks).
ALTER TABLE experiment_responses
  ADD COLUMN IF NOT EXISTS queue_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_experiment_responses_author_experiment_queue
  ON experiment_responses (author_id, experiment_type, queue_index);
