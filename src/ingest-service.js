import { SOURCES } from "../config/sources";
import { scanMarket } from "./pipeline";
import { detectArticleOrganizations } from "./article-organizations";
import { ensureDatabase } from "./database";
import { buildDailyIntelligence } from "./agents/correlation-trends.js";
import { buildDailyStory } from "./agents/story-builder.js";
import { discoverSourceCandidates } from "./agents/source-guardian.js";
import { DEFAULT_WATCH_RULES, rankItems } from "./watch-rules.js";

export async function ingestMarket() {
  const sql = await ensureDatabase();
  const report = await scanMarket({
    sources: SOURCES,
    concurrency: 4,
    validateLinks: process.env.SOURCE_LINK_VALIDATION !== "false",
    readArticlePages: process.env.SOURCE_ARTICLE_READING !== "false",
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
    item.id = articleId;
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

  // Re-score recent stored rows with the current rules. This removes stale
  // categories created by older, more permissive versions of the scanner.
  await refreshArticleClassification(sql);

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

  const storyRows = await sql`
    SELECT id, canonical_url, title, summary, published_at, source_id, score, categories, relevance, metadata
    FROM articles ORDER BY published_at DESC NULLS LAST LIMIT 100
  `;
  const storyArticles = storyRows.map((row) => ({
    id: row.id,
    url: row.canonical_url,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at,
    sourceId: row.source_id,
    score: Number(row.score || 0),
    categories: row.categories || [],
    relevance: row.relevance || [],
    metadata: row.metadata || {},
  }));
  const intelligence = buildDailyIntelligence({ articles: storyArticles });
  const story = buildDailyStory({ articles: storyArticles, intelligence, now: report.scannedAt });
  if (story) await persistDailyStory(sql, story);

  return {
    ...report,
    stored,
    sourceCandidates,
    intelligence,
    story,
  };
}

async function persistDailyStory(sql, story) {
  await sql`
    INSERT INTO daily_stories
      (story_date, generated_at, headline, standfirst, body, category, confidence, article_ids, evidence, metadata)
    VALUES
      (${story.storyDate}, ${story.generatedAt}, ${story.headline}, ${story.standfirst}, ${story.body},
       ${story.category}, ${story.confidence}, ${story.articleIds}, ${JSON.stringify(story.evidence)}::jsonb,
       ${JSON.stringify(story.metadata)}::jsonb)
    ON CONFLICT (story_date) DO UPDATE SET
      generated_at = EXCLUDED.generated_at,
      headline = EXCLUDED.headline,
      standfirst = EXCLUDED.standfirst,
      body = EXCLUDED.body,
      category = EXCLUDED.category,
      confidence = EXCLUDED.confidence,
      article_ids = EXCLUDED.article_ids,
      evidence = EXCLUDED.evidence,
      metadata = EXCLUDED.metadata
  `;
}

async function refreshArticleClassification(sql) {
  const rows = await sql`
    SELECT id, canonical_url, title, summary, published_at, source_id, score, categories, relevance, metadata
    FROM articles ORDER BY updated_at DESC LIMIT 250
  `;
  for (const row of rows) {
    const [ranked] = rankItems([{
      url: row.canonical_url,
      title: row.title,
      summary: row.summary,
      publishedAt: row.published_at,
      sourceId: row.source_id,
      score: row.score,
      metadata: row.metadata || {},
    }], DEFAULT_WATCH_RULES);
    const categories = ranked?.relevance?.map((match) => match.category) || [];
    const relevance = ranked?.relevance || [];
    const score = ranked?.score || 0;
    await sql`
      UPDATE articles SET categories = ${categories}, relevance = ${JSON.stringify(relevance)}::jsonb,
        score = ${score}, updated_at = now()
      WHERE id = ${row.id}
    `;
  }
}
