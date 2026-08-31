import { SOURCES } from "../config/sources";
import { scanMarket } from "./pipeline";
import { detectArticleOrganizations } from "./article-organizations";
import { ensureDatabase } from "./database";
import { buildDailyIntelligence } from "./agents/correlation-trends.js";
import { discoverSourceCandidates } from "./agents/source-guardian.js";

export async function ingestMarket() {
  const sql = await ensureDatabase();
  const report = await scanMarket({
    sources: SOURCES,
    concurrency: 4,
    validateLinks: process.env.SOURCE_LINK_VALIDATION !== "false",
  });
  let stored = 0;

  for (const item of report.items) {
    const categories = [...new Set(item.relevance.map((match) => match.category))];
    const rows = await sql`
      INSERT INTO articles
        (canonical_url, title, summary, published_at, source_id, source_url,
         score, categories, relevance, metadata)
      VALUES
        (${item.url}, ${item.title}, ${item.summary || null}, ${item.publishedAt || null},
         ${item.sourceId || null}, ${item.sourceUrl || null}, ${item.score || 0},
         ${categories}, ${JSON.stringify(item.relevance)}::jsonb,
         ${JSON.stringify(item.metadata || {})}::jsonb)
      ON CONFLICT (canonical_url) DO UPDATE SET
        title = EXCLUDED.title,
        summary = COALESCE(EXCLUDED.summary, articles.summary),
        published_at = COALESCE(EXCLUDED.published_at, articles.published_at),
        source_id = EXCLUDED.source_id,
        score = GREATEST(articles.score, EXCLUDED.score),
        categories = EXCLUDED.categories,
        relevance = EXCLUDED.relevance,
        metadata = articles.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING id
    `;
    const articleId = rows[0].id;
    for (const match of detectArticleOrganizations(item)) {
      await sql`
        INSERT INTO article_organizations
          (article_id, organization_id, match_kind, confidence)
        VALUES (${articleId}, ${match.organizationId}, ${match.matchKind}, ${match.confidence})
        ON CONFLICT (article_id, organization_id) DO UPDATE SET
          match_kind = EXCLUDED.match_kind,
          confidence = GREATEST(article_organizations.confidence, EXCLUDED.confidence)
      `;
    }
    stored += 1;
  }

  await sql`
    INSERT INTO scan_runs (scanned_at, fetched, relevant, stored, sources)
    VALUES (${report.scannedAt}, ${report.fetched}, ${report.relevant}, ${stored},
            ${JSON.stringify(report.sources)}::jsonb)
  `;

  const sourceCandidates = discoverSourceCandidates(report.items, {
    knownDomains: SOURCES.map((source) => {
      try { return new URL(source.url).hostname; } catch { return ""; }
    }),
  });
  for (const candidate of sourceCandidates) {
    await sql`
      INSERT INTO source_candidates (domain, example_url, occurrences, subjects, score)
      VALUES (${candidate.domain}, ${candidate.exampleUrl}, ${candidate.occurrences}, ${candidate.subjects}, ${candidate.score})
      ON CONFLICT (domain) DO UPDATE SET
        example_url = EXCLUDED.example_url,
        occurrences = source_candidates.occurrences + EXCLUDED.occurrences,
        subjects = EXCLUDED.subjects,
        score = GREATEST(source_candidates.score, EXCLUDED.score),
        last_seen_at = now()
    `;
  }

  return {
    ...report,
    stored,
    sourceCandidates,
    intelligence: buildDailyIntelligence({ articles: report.items }),
  };
}
