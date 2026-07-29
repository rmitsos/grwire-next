CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  sector TEXT,
  country_code CHAR(2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  published_at TIMESTAMPTZ,
  source_id TEXT,
  source_url TEXT,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS article_organizations (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  match_kind TEXT NOT NULL DEFAULT 'alias',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY (article_id, organization_id)
);

CREATE TABLE IF NOT EXISTS relationship_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_organization_id TEXT NOT NULL REFERENCES organizations(id),
  target_organization_id TEXT NOT NULL REFERENCES organizations(id),
  relationship_type TEXT NOT NULL,
  claim_status TEXT NOT NULL CHECK (
    claim_status IN ('confirmed', 'reported', 'assessment', 'rumour', 'disputed', 'expired')
  ),
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  direction TEXT NOT NULL DEFAULT 'directed',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  rationale TEXT,
  impact JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  CHECK (source_organization_id <> target_organization_id),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CHECK (visibility = 'private' OR claim_status IN ('confirmed', 'reported'))
);

CREATE TABLE IF NOT EXISTS relationship_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationship_claims(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  url TEXT,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  quote TEXT,
  note TEXT,
  source_id TEXT,
  author TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  CHECK (url IS NOT NULL OR note IS NOT NULL),
  CHECK (visibility = 'private' OR kind <> 'professional_note')
);

CREATE INDEX IF NOT EXISTS articles_published_idx ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS articles_source_idx ON articles (source_id);
CREATE INDEX IF NOT EXISTS article_organizations_org_idx
  ON article_organizations (organization_id, article_id);
CREATE INDEX IF NOT EXISTS relationship_claims_source_idx
  ON relationship_claims (source_organization_id);
CREATE INDEX IF NOT EXISTS relationship_claims_target_idx
  ON relationship_claims (target_organization_id);
CREATE INDEX IF NOT EXISTS relationship_claims_visibility_idx
  ON relationship_claims (visibility, claim_status);

-- Public consumers query views, never the underlying knowledge tables.
CREATE OR REPLACE VIEW public_relationship_claims AS
SELECT
  id,
  source_organization_id,
  target_organization_id,
  relationship_type,
  claim_status,
  confidence,
  direction,
  valid_from,
  valid_to,
  impact,
  reviewed_at
FROM relationship_claims
WHERE visibility = 'public'
  AND claim_status IN ('confirmed', 'reported');

CREATE OR REPLACE VIEW public_relationship_evidence AS
SELECT
  id,
  relationship_id,
  kind,
  url,
  article_id,
  observed_at,
  quote,
  source_id
FROM relationship_evidence
WHERE visibility = 'public'
  AND kind <> 'professional_note';
