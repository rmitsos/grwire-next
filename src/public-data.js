import { getSql } from "./database.js";
import { collapseDuplicateArticles, cleanTitleForSource } from "./article-quality.js";
import { DEFAULT_WATCH_RULES, rankItems } from "./watch-rules.js";
import { storyDateToIso } from "./story-date.js";
import { canonicalizeUrl } from "./sources/utils.js";
import { isGoogleNewsUrl } from "./google-news.js";
import { SOURCES } from "../config/sources.js";
import {
  DEFAULT_DAY_CAP_PER_SOURCE,
  DEFAULT_HOME_CAP_PER_SOURCE,
  SECTION_SHARE_CAP,
  athensDayKey,
  isFresh,
  noiseRejectReason,
  splitByFreshness,
} from "./feed-rules.js";

const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));

// Ingest runs repeatedly and the day cap (sources-spec.md §5/§2) must also
// hold for rows already written earlier that day, so it is re-applied here
// on read without touching the DB schema or writing back to it.
export function applyDayCap(rows, { now = Date.now() } = {}) {
  const dayCounts = new Map();
  const kept = [];
  for (const row of rows) {
    const cap = SOURCE_BY_ID.get(row.source_id)?.dayCap ?? DEFAULT_DAY_CAP_PER_SOURCE;
    const key = `${row.source_id}|${athensDayKey(row.published_at, now)}`;
    const count = dayCounts.get(key) || 0;
    if (count >= cap) continue;
    dayCounts.set(key, count + 1);
    kept.push(row);
  }
  return kept;
}

export const PUBLIC_CATEGORIES = {
  finance: {
    name: "Finance",
    deck: "Banks, listed companies, capital markets and the Greek economy.",
    // Closest match for sources-spec.md §1's deals-companies id. The spec
    // section is narrower (operator/utility/infrastructure companies only);
    // this slug covers all Greek finance news.
    specId: "deals-companies",
  },
  telco: {
    name: "Telecom Infrastructure",
    deck: "Fibre, mobile networks, regulation and digital infrastructure.",
    specId: "telecom-fibre",
  },
  energy: {
    name: "Energy Infrastructure",
    deck: "Power grids, storage, interconnections and energy investment.",
    specId: "energy-grids",
  },
  infrastructure: {
    name: "Infrastructure",
    deck: "Construction, concessions, transport, data centres and strategic projects.",
    specId: "infrastructure-works",
  },
};

export const SECTION_SLUG_BY_SPEC_ID = Object.fromEntries(
  Object.entries(PUBLIC_CATEGORIES).map(([slug, config]) => [config.specId, slug]),
);

export async function getLatestArticles({ category, query, limit = 80 } = {}) {
  const sql = getSql();
  if (!sql) return [];
  try {
    let rows;
    const queryLimit = Math.min(Math.max(limit * 3, limit), 300);
    if (category && query) {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT * FROM articles
        WHERE title ILIKE ${pattern} OR summary ILIKE ${pattern}
        ORDER BY COALESCE(published_at, updated_at) DESC NULLS LAST LIMIT ${queryLimit}
      `;
    } else if (category) {
      rows = await sql`
        SELECT * FROM articles
        ORDER BY COALESCE(published_at, updated_at) DESC NULLS LAST LIMIT ${queryLimit}
      `;
    } else if (query) {
      const pattern = `%${query}%`;
      rows = await sql`
        SELECT * FROM articles
        WHERE title ILIKE ${pattern} OR summary ILIKE ${pattern}
        ORDER BY COALESCE(published_at, updated_at) DESC NULLS LAST LIMIT ${queryLimit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM articles
        ORDER BY COALESCE(published_at, updated_at) DESC NULLS LAST LIMIT ${queryLimit}
      `;
    }
    // sources-spec.md §5 noise_hard_reject and the §5/§2 per-source day cap
    // apply at read time too, so previously-stored rows that predate these
    // rules (or that ingest keeps re-upserting) disappear from the pages
    // without a DB migration or write.
    const withoutNoise = rows.filter((row) => !noiseRejectReason(row));
    const dayCapped = applyDayCap(withoutNoise);
    let cleaned = collapseDuplicateArticles(dayCapped).map(reclassifyRow);
    if (category) cleaned = cleaned.filter((row) => row.categories.includes(category));
    return cleaned.slice(0, limit).map(toArticle);
  } catch (error) {
    // Rethrow so a cached page keeps its last good copy instead of caching an empty one.
    console.error("[public] article read failed:", error?.message || error);
    throw error;
  }
}

export async function getHomepageData() {
  const [articles, story] = await Promise.all([getLatestArticles({ limit: 100 }), getLatestStory()]);
  return { articles, story, ...buildHomepageSections(articles) };
}

/**
 * Lays out the homepage without repeating an article across sections. Each
 * article is placed once: as the lead, in "recent", or in the column for its
 * single highest-scoring category (categories[0], already rank-ordered by
 * rankItems). Section pages still list every matching article separately.
 *
 * Also enforces, across lead + recent + columns together:
 *  - sources-spec.md §3 max_age_hours.news: only items published within the
 *    last 72h are homepage-eligible (items with no publishedAt never are).
 *  - §2 home_cap per source (default DEFAULT_HOME_CAP_PER_SOURCE).
 *  - §5 homepage.section_share_max (35%), applied after the per-source cap,
 *    over the primary category (categories[0]).
 *  - Google News items flagged metadata.sectionOnly (§2 "Google News
 *    handling") are excluded; section pages still list them.
 * Skipped items are never replaced with padding: a slot that runs out of
 * eligible articles is just left shorter than its usual capacity.
 * Out of scope this round: spec homepage.max_items (20) and per-section
 * homepage_caps / min_score — see sources-spec.md §5 and §1.
 */
export function buildHomepageSections(articles = [], { now = Date.now() } = {}) {
  const { fresh } = splitByFreshness(articles, { now });

  const shown = new Set();
  const perSourceCount = new Map();
  const perSectionCount = new Map();

  const eligible = (article) => {
    if (article.metadata?.sectionOnly) return false;
    if (shown.has(canonicalizeUrl(article.url))) return false;
    const homeCap = SOURCE_BY_ID.get(article.sourceId)?.homeCap ?? DEFAULT_HOME_CAP_PER_SOURCE;
    if ((perSourceCount.get(article.sourceId) || 0) >= homeCap) return false;
    const section = article.categories?.[0];
    if (section && (perSectionCount.get(section) || 0) >= SECTION_SHARE_CAP) return false;
    return true;
  };
  const take = (article) => {
    shown.add(canonicalizeUrl(article.url));
    perSourceCount.set(article.sourceId, (perSourceCount.get(article.sourceId) || 0) + 1);
    const section = article.categories?.[0];
    if (section) perSectionCount.set(section, (perSectionCount.get(section) || 0) + 1);
    return article;
  };

  let lead = null;
  for (const article of fresh) {
    if (eligible(article)) { lead = take(article); break; }
  }

  const recent = [];
  for (const article of fresh) {
    if (recent.length >= 12) break;
    if (shown.has(canonicalizeUrl(article.url))) continue;
    if (eligible(article)) recent.push(take(article));
  }

  const columns = Object.fromEntries(Object.keys(PUBLIC_CATEGORIES).map((category) => [category, []]));
  for (const article of fresh) {
    if (shown.has(canonicalizeUrl(article.url))) continue;
    const primaryCategory = article.categories?.[0];
    if (!primaryCategory || !columns[primaryCategory]) continue;
    if (columns[primaryCategory].length >= 5) continue;
    if (eligible(article)) columns[primaryCategory].push(take(article));
  }

  return { lead, recent, columns };
}

export async function getLatestStory() {
  const sql = getSql();
  if (!sql) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date());
  try {
    const rows = await sql`
      SELECT story_date, generated_at, headline, standfirst, body, category, confidence, article_ids, evidence, metadata
      FROM daily_stories ORDER BY story_date DESC, generated_at DESC LIMIT 1
    `;
    // The homepage's top slot is explicitly today's story. Older records stay
    // searchable in the archive but must not look like current coverage.
    if (!rows[0] || storyDateToIso(rows[0].story_date)?.slice(0, 10) !== today) return null;
    return toStory(rows[0]);
  } catch (error) {
    console.error("[public] story read failed:", error?.message || error);
    throw error;
  }
}

export async function searchStories({ query, limit = 50 } = {}) {
  const sql = getSql();
  if (!sql || !query) return [];
  try {
    const pattern = `%${String(query).slice(0, 100)}%`;
    const rows = await sql`
      SELECT story_date, generated_at, headline, standfirst, body, category, confidence, article_ids, evidence, metadata
      FROM daily_stories
      WHERE headline ILIKE ${pattern} OR standfirst ILIKE ${pattern} OR array_to_string(body, ' ') ILIKE ${pattern}
      ORDER BY story_date DESC, generated_at DESC LIMIT ${Math.min(Math.max(limit, 1), 100)}
    `;
    return rows.map(toStory);
  } catch (error) {
    console.error("[public] story search failed:", error?.message || error);
    return [];
  }
}

function toArticle(row) {
  let hostname;
  try { hostname = new URL(row.canonical_url).hostname.replace(/^www\./, ""); } catch { hostname = undefined; }
  return {
    id: row.id,
    url: row.canonical_url,
    title: cleanTitleForSource(row.title, [SOURCE_BY_ID.get(row.source_id)?.name, hostname, row.metadata?.publisher]),
    summary: row.summary,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    sourceId: row.source_id,
    score: Number(row.score),
    categories: row.categories || [],
    relevance: row.relevance || [],
    // rows stored before Google News flagging existed have no metadata.sectionOnly,
    // so any news.google.com link is treated as sectionOnly at read time too.
    metadata: {
      sectionOnly: Boolean(row.metadata?.sectionOnly) || isGoogleNewsUrl(row.canonical_url),
      publisher: row.metadata?.publisher,
      relatedPublishers: row.metadata?.relatedPublishers || [],
    },
  };
}

function toStory(row) {
  return {
    storyDate: storyDateToIso(row.story_date),
    generatedAt: row.generated_at ? new Date(row.generated_at).toISOString() : null,
    headline: row.headline,
    standfirst: row.standfirst,
    body: row.body || [],
    category: row.category,
    confidence: Number(row.confidence || 0),
    articleIds: row.article_ids || [],
    evidence: row.evidence || [],
    metadata: row.metadata || {},
  };
}


function reclassifyRow(row) {
  const [ranked] = rankItems([{
    url: row.canonical_url,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at,
    sourceId: row.source_id,
    metadata: row.metadata || {},
  }], DEFAULT_WATCH_RULES);
  return {
    ...row,
    categories: ranked?.relevance?.map((match) => match.category) || [],
    relevance: ranked?.relevance || [],
    score: ranked?.score || 0,
  };
}
