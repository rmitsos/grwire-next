import { neon } from "@neondatabase/serverless";
import { ORGANIZATIONS } from "./organizations";

let schemaPromise;

export function getSql() {
  const connectionString = process.env.DATABASE_URL;
  return connectionString ? neon(connectionString) : null;
}

export async function ensureDatabase() {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured");
  if (!schemaPromise) {
    schemaPromise = createSchema(sql).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  await schemaPromise;
  return sql;
}

async function createSchema(sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      aliases TEXT[] NOT NULL DEFAULT '{}',
      sector TEXT,
      country_code CHAR(2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      canonical_url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      published_at TIMESTAMPTZ,
      source_id TEXT,
      source_url TEXT,
      score NUMERIC(5,2) NOT NULL DEFAULT 0,
      categories TEXT[] NOT NULL DEFAULT '{}',
      relevance JSONB NOT NULL DEFAULT '[]',
      metadata JSONB NOT NULL DEFAULT '{}',
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE articles ADD COLUMN IF NOT EXISTS relevance JSONB NOT NULL DEFAULT '[]'`;
  await sql`
    CREATE TABLE IF NOT EXISTS article_organizations (
      article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      match_kind TEXT NOT NULL DEFAULT 'alias',
      confidence NUMERIC(4,3) NOT NULL DEFAULT 1 CHECK (confidence BETWEEN 0 AND 1),
      PRIMARY KEY (article_id, organization_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS relationship_claims (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_organization_id TEXT NOT NULL REFERENCES organizations(id),
      target_organization_id TEXT NOT NULL REFERENCES organizations(id),
      relationship_type TEXT NOT NULL,
      claim_status TEXT NOT NULL,
      confidence NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
      direction TEXT NOT NULL DEFAULT 'directed',
      visibility TEXT NOT NULL DEFAULT 'private',
      valid_from TIMESTAMPTZ,
      valid_to TIMESTAMPTZ,
      rationale TEXT,
      impact JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at TIMESTAMPTZ
    )
  `;
  await sql`
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
      visibility TEXT NOT NULL DEFAULT 'private'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS articles_published_idx ON articles (published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS articles_categories_idx ON articles USING GIN (categories)`;
  await sql`CREATE INDEX IF NOT EXISTS relationship_claims_source_idx ON relationship_claims (source_organization_id)`;
  await sql`CREATE INDEX IF NOT EXISTS relationship_claims_target_idx ON relationship_claims (target_organization_id)`;

  for (const organization of ORGANIZATIONS) {
    await sql`
      INSERT INTO organizations (id, name, aliases, country_code)
      VALUES (${organization.id}, ${organization.name}, ${organization.aliases || []}, 'GR')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        aliases = EXCLUDED.aliases,
        updated_at = now()
    `;
  }
}
