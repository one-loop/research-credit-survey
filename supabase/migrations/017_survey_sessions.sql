-- Real-time session and funnel drop-off tracking table
CREATE TABLE IF NOT EXISTS survey_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    author_id TEXT,
    experiment_type TEXT,
    current_step TEXT NOT NULL DEFAULT 'landing',
    highest_step TEXT NOT NULL DEFAULT 'landing',
    step_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    response_id TEXT,
    demographics JSONB,
    metadata JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rapid funnel analytics and drop-off aggregations
CREATE INDEX IF NOT EXISTS idx_survey_sessions_current_step ON survey_sessions (current_step);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_highest_step ON survey_sessions (highest_step);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_is_completed ON survey_sessions (is_completed);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_author_id ON survey_sessions (author_id);
CREATE INDEX IF NOT EXISTS idx_survey_sessions_last_active ON survey_sessions (last_active_at DESC);

-- Enable RLS (admin service_role key bypasses this automatically)
ALTER TABLE survey_sessions ENABLE ROW LEVEL SECURITY;
