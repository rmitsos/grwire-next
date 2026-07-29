import { detectArticleOrganizations } from "../article-organizations.js";

/**
 * Minimal PostgreSQL store. The client only needs node-postgres-compatible
 * query(text, values); this keeps Neon, Vercel Postgres and local Postgres
 * interchangeable.
 */
export class PostgresStore {
  constructor({ client, organizations }) {
    if (!client?.query) throw new TypeError("PostgresStore requires a query client");
    this.client = client;
    this.organizations = organizations;
  }

  async upsertOrganizations(organizations) {
    for (const organization of organizations) {
      await this.client.query(
        `INSERT INTO organizations (id, name, aliases, sector, country_code)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           aliases = EXCLUDED.aliases,
           sector = EXCLUDED.sector,
           country_code = EXCLUDED.country_code,
           updated_at = now()`,
        [
          organization.id,
          organization.name,
          organization.aliases || [],
          organization.sector || null,
          organization.countryCode || null,
        ],
      );
    }
    return { imported: organizations.length };
  }

  async upsertItems(items) {
    let imported = 0;
    for (const item of items) {
      const result = await this.client.query(
        `INSERT INTO articles
           (canonical_url, title, summary, published_at, source_id, source_url, score, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (canonical_url) DO UPDATE SET
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           published_at = COALESCE(EXCLUDED.published_at, articles.published_at),
           source_id = EXCLUDED.source_id,
           score = GREATEST(articles.score, EXCLUDED.score),
           metadata = articles.metadata || EXCLUDED.metadata,
           updated_at = now()
         RETURNING id`,
        [
          item.url,
          item.title,
          item.summary || null,
          item.publishedAt || null,
          item.sourceId || null,
          item.sourceUrl || null,
          item.score || 0,
          item.metadata || {},
        ],
      );
      const articleId = result.rows[0].id;
      const matches = detectArticleOrganizations(item, this.organizations);
      for (const match of matches) {
        await this.client.query(
          `INSERT INTO article_organizations
             (article_id, organization_id, match_kind, confidence)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (article_id, organization_id) DO UPDATE SET
             match_kind = EXCLUDED.match_kind,
             confidence = GREATEST(article_organizations.confidence, EXCLUDED.confidence)`,
          [articleId, match.organizationId, match.matchKind, match.confidence],
        );
      }
      imported += 1;
    }
    return { imported };
  }

  async saveRelationship(relationship) {
    await this.client.query("BEGIN");
    try {
      await this.client.query(
        `INSERT INTO relationship_claims
           (id, source_organization_id, target_organization_id, relationship_type,
            claim_status, confidence, direction, visibility, valid_from, valid_to,
            rationale, impact, created_at, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           claim_status = EXCLUDED.claim_status,
           confidence = EXCLUDED.confidence,
           visibility = EXCLUDED.visibility,
           valid_from = EXCLUDED.valid_from,
           valid_to = EXCLUDED.valid_to,
           rationale = EXCLUDED.rationale,
           impact = EXCLUDED.impact,
           reviewed_at = EXCLUDED.reviewed_at`,
        [
          relationship.id,
          relationship.sourceOrganizationId,
          relationship.targetOrganizationId,
          relationship.type,
          relationship.status,
          relationship.confidence,
          relationship.direction,
          relationship.visibility,
          relationship.validFrom || null,
          relationship.validTo || null,
          relationship.rationale || null,
          relationship.impact || null,
          relationship.createdAt,
          relationship.reviewedAt || null,
        ],
      );
      await this.client.query("DELETE FROM relationship_evidence WHERE relationship_id = $1", [relationship.id]);
      for (const evidence of relationship.evidence) {
        await this.client.query(
          `INSERT INTO relationship_evidence
             (relationship_id, kind, url, article_id, observed_at, quote, note,
              source_id, author, visibility)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            relationship.id,
            evidence.kind,
            evidence.url || null,
            evidence.articleId || null,
            evidence.observedAt,
            evidence.quote || null,
            evidence.note || null,
            evidence.sourceId || null,
            evidence.author || null,
            evidence.visibility || "private",
          ],
        );
      }
      await this.client.query("COMMIT");
      return relationship;
    } catch (error) {
      await this.client.query("ROLLBACK");
      throw error;
    }
  }
}
