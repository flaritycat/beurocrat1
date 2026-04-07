CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  municipality TEXT NOT NULL,
  location_text TEXT,
  gnr_bnr TEXT,
  coordinates geometry(Point, 4326),
  issue_type TEXT NOT NULL DEFAULT 'annet',
  current_status TEXT NOT NULL DEFAULT 'ny',
  desired_outcome TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_municipality ON cases (municipality);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (current_status);
CREATE INDEX IF NOT EXISTS idx_cases_issue_type ON cases (issue_type);
CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON cases (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_coordinates ON cases USING GIST (coordinates);

CREATE TABLE IF NOT EXISTS case_interview_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  summary TEXT,
  extracted_user_statement TEXT,
  extracted_documented_fact TEXT,
  extracted_uncertainty TEXT,
  extracted_possible_issue TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (case_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_case_interview_answers_case_id ON case_interview_answers (case_id, created_at);

CREATE TABLE IF NOT EXISTS case_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  source_label TEXT,
  source_url TEXT,
  evidence_date DATE,
  description TEXT,
  supports_point TEXT,
  reliability_level TEXT NOT NULL DEFAULT 'middels',
  verification_status TEXT NOT NULL DEFAULT 'ubekreftet',
  storage_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_evidence_case_id ON case_evidence (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS case_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  publisher TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  publication_date DATE,
  authority_level TEXT NOT NULL DEFAULT 'kontekstuell',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_sources_case_id ON case_sources (case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS case_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_reference TEXT,
  certainty_level TEXT NOT NULL DEFAULT 'middels',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_timeline_events_case_id ON case_timeline_events (case_id, event_date ASC);

CREATE TABLE IF NOT EXISTS case_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL UNIQUE REFERENCES cases (id) ON DELETE CASCADE,
  known_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  uncertainties JSONB NOT NULL DEFAULT '[]'::jsonb,
  possible_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_output (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_output_case_id ON case_output (case_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS map_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  geometry_json JSONB NOT NULL,
  source_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_map_observations_case_id ON map_observations (case_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_cases_updated_at ON cases;
CREATE TRIGGER trg_cases_updated_at
BEFORE UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_case_analysis_updated_at ON case_analysis;
CREATE TRIGGER trg_case_analysis_updated_at
BEFORE UPDATE ON case_analysis
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_case_output_updated_at ON case_output;
CREATE TRIGGER trg_case_output_updated_at
BEFORE UPDATE ON case_output
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
