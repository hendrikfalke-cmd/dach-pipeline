-- ============================================================
-- DACH Pipeline — Neon Schema
-- Run this in the Neon SQL Editor to set up your database
-- ============================================================

CREATE TABLE active_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  industry TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  ebitda TEXT DEFAULT '',
  status TEXT DEFAULT '',
  timing TEXT DEFAULT 'Live',
  strategy TEXT DEFAULT 'MDF',
  origination TEXT DEFAULT '',
  sponsors_interested TEXT DEFAULT '',
  sponsors_declined TEXT DEFAULT '',
  advisors TEXT DEFAULT '',
  priority TEXT DEFAULT 'warm',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expected_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  industry TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  ebitda TEXT DEFAULT '',
  comment TEXT DEFAULT '',
  timing TEXT DEFAULT 'TBD',
  expected_strategy TEXT DEFAULT '',
  origination TEXT DEFAULT '',
  sponsors_interested TEXT DEFAULT '',
  sponsors_declined TEXT DEFAULT '',
  advisors TEXT DEFAULT '',
  priority TEXT DEFAULT 'warm',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dead_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project TEXT DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  industry TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  ebitda TEXT DEFAULT '',
  status TEXT DEFAULT '',
  timing TEXT DEFAULT '',
  strategy TEXT DEFAULT '',
  origination TEXT DEFAULT '',
  sponsors_interested TEXT DEFAULT '',
  sponsors_declined TEXT DEFAULT '',
  advisors TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  archived_from TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pipeline_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_type TEXT NOT NULL DEFAULT 'pipeline',
  source_type TEXT NOT NULL DEFAULT 'image',
  image_url TEXT,
  raw_text TEXT,
  extracted_data JSONB DEFAULT '{}',
  applied_changes JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  deals_added INT DEFAULT 0,
  deals_updated INT DEFAULT 0,
  deals_removed INT DEFAULT 0,
  meeting_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meeting_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES pipeline_uploads(id) ON DELETE SET NULL,
  raw_content TEXT NOT NULL,
  parsed_updates JSONB DEFAULT '{}',
  affected_deal_ids UUID[] DEFAULT '{}',
  meeting_date DATE DEFAULT CURRENT_DATE,
  meeting_with TEXT DEFAULT '',
  deal_company TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER active_deals_updated_at
  BEFORE UPDATE ON active_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER expected_deals_updated_at
  BEFORE UPDATE ON expected_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_meeting_notes_deal_ids ON meeting_notes USING GIN (affected_deal_ids);
CREATE INDEX idx_meeting_notes_company ON meeting_notes (deal_company);
CREATE INDEX idx_meeting_notes_date ON meeting_notes (meeting_date DESC);
CREATE INDEX idx_pipeline_uploads_type ON pipeline_uploads (upload_type);
CREATE INDEX idx_pipeline_uploads_created ON pipeline_uploads (created_at DESC);
