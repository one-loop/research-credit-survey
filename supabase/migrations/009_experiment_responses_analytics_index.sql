-- Speed up histogram / leaderboard queries by experiment.
CREATE INDEX IF NOT EXISTS idx_experiment_responses_experiment_accuracy
  ON experiment_responses (experiment_type)
  WHERE average_accuracy IS NOT NULL;
