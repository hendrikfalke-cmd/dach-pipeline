-- ─────────────────────────────────────────────────────────────────────────────
-- Sponsor CRM schema — run this in your Neon SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Institutions (PE firms, family offices, banks, debt funds, etc.)
CREATE TABLE IF NOT EXISTS crm_institutions (
  id          TEXT        PRIMARY KEY,  -- set by client, e.g. "si<timestamp>"
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'PE', -- PE | FO | BANK | DEBT | OTHER
  hq          TEXT        NOT NULL DEFAULT '',
  region      TEXT        NOT NULL DEFAULT '',
  aum         TEXT        NOT NULL DEFAULT '',
  strategy    TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts at each institution
CREATE TABLE IF NOT EXISTS crm_contacts (
  id             TEXT        PRIMARY KEY,
  institution_id TEXT        NOT NULL REFERENCES crm_institutions(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT '',
  email          TEXT        NOT NULL DEFAULT '',
  notes          TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Interactions (meetings, calls, emails, conferences)
CREATE TABLE IF NOT EXISTS crm_interactions (
  id             TEXT        PRIMARY KEY,
  institution_id TEXT        NOT NULL REFERENCES crm_institutions(id) ON DELETE CASCADE,
  contact_ids    TEXT[]      NOT NULL DEFAULT '{}',
  date           DATE        NOT NULL,
  type           TEXT        NOT NULL DEFAULT 'Meeting', -- Meeting | Call | Email | Conference | Other
  location       TEXT        NOT NULL DEFAULT '',
  summary        TEXT        NOT NULL DEFAULT '',
  raw_notes      TEXT        NOT NULL DEFAULT '',
  signals        JSONB       NOT NULL DEFAULT '[]'::jsonb,
  deals          JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI-synthesized investment profiles (one per institution)
CREATE TABLE IF NOT EXISTS crm_synthesized_profiles (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id       TEXT        NOT NULL UNIQUE REFERENCES crm_institutions(id) ON DELETE CASCADE,
  investment_thesis    TEXT        NOT NULL DEFAULT '',
  strong_likes         TEXT        NOT NULL DEFAULT '',
  avoids               TEXT        NOT NULL DEFAULT '',
  preferred_structures TEXT        NOT NULL DEFAULT '',
  typical_deal         TEXT        NOT NULL DEFAULT '',
  coverage_note        TEXT        NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS crm_contacts_institution_id_idx      ON crm_contacts(institution_id);
CREATE INDEX IF NOT EXISTS crm_interactions_institution_id_idx  ON crm_interactions(institution_id);
CREATE INDEX IF NOT EXISTS crm_interactions_date_idx            ON crm_interactions(date DESC);
CREATE INDEX IF NOT EXISTS crm_profiles_institution_id_idx      ON crm_synthesized_profiles(institution_id);
