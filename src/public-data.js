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
  HOMEPAGE_MAX_ITEMS,
  SECTION_HOMEPAGE_CAPS,
  SECTION_SHARE_CAP,
  athensDayKey,
  homepageSectionOf,
  isFresh,
  noiseRejectReason,
  rulesOverrideCategory,
  splitByFreshness,
} from "./feed-rules.js";

const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));

// Ingest runs repeatedly and the day cap (sources-spec.md §5/§2) must also
// hold for rows already written earlier that day, so it is re-applied here
// on read without touching the DB schema or writing back to it.
export function applyDayCap(rows, { now = Date.now(), onDrop } = {}) {
  const dayCounts = new Map();
  const kept = [];
  for (const row of rows) {
    const cap = SOURCE_BY_ID.get(row.source_id)?.dayCap ?? DEFAULT_DAY_CAP_PER_SOURCE;
    const key = `${row.source_id}|${athensDayKey(row.published_at, now)}`;
    const count = dayCounts.get(key) || 0;
    if (count >= cap) { onDrop?.(row); continue; }
    dayCounts.set(key, count + 1);
    kept.push(row);
  }
  return kept;
}

export const PUBLIC_CATEGORIES = {
  deals: {
    name: "Deals & companies",
    deck: "Operators, utilities, tower, fibre, grid and infrastructure companies: deals, results, M&A and investment.",
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
  tenders: {
    name: "Tenders & contracts",
    deck: "ΚΗΜΔΗΣ/Διαύγεια tenders and contracts, and press coverage of a specific tender.",
    specId: "tenders-contracts",
  },
  regulators: {
    name: "Regulators & policy",
    deck: "ΕΕΤΤ, ΡΑΑΕΥ and ministry decisions, consultations, regulation and spectrum policy.",
    specId: "regulators-policy",
  },
};

export const SECTION_SLUG_BY_SPEC_ID = Object.fromEntries(
  Object.entries(PUBLIC_CATEGORIES).map(([slug, config]) => [config.specId, slug]),
);

/**
 * Pure selection pipeline shared by getLatestArticles (reads from the DB)
 * and scripts/review-dump.js (reads from a fresh, DB-less scan): noise/
 * ppc_non_network/political drop, the per-source day cap, dedupe, rules
 * reclassification (including the tenders/regulators rules-only override),
 * category filter, then conversion to the public article shape.
 * `onDrop(row, reason)` is called, where easy, for every row that does not
 * survive a stage — `reason` is `{ stage, group, term }` for the noise
 * stage (same shape as feed-rules.js noiseRejectReason) or `{ stage }` for
 * day_cap/duplicate.
 */
export function selectArticles(rows, { category, limit = 80, now = Date.now(), onDrop } = {}) {
  const withoutNoise = rows.filter((row) => {
    const reason = noiseRejectReason(row);
    if (!reason) return true;
    onDrop?.(row, { stage: "noise", ...reason });
    return false;
  });
  const dayCapped = applyDayCap(withoutNoise, { now, onDrop: (row) => onDrop?.(row, { stage: "day_cap" }) });
  const deduped = collapseDuplicateArticles(dayCapped, { onDrop: (row) => onDrop?.(row, { stage: "duplicate" }) });
  let cleaned = deduped.map(reclassifyRow);
  if (category) cleaned = cleaned.filter((row) => row.categories.includes(category));
  return cleaned.slice(0, limit).map(toArticle);
}

export async function getLatestArticles({ category, query, limit = 80 } = {}) {
  const sql = getSql();
  if (!sql) return [];
  try {
    let rows;
    const queryLimit = Math.min(Math.max(limit * 3, limit), 300);
    if (query) {
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
    return selectArticles(rows, { category, limit });
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
 *  - §1 homepage_cap per spec section (SECTION_HOMEPAGE_CAPS, keyed by
 *    homepageSectionOf(article) — the article's primary *spec* section,
 *    which can differ from its public-category column), capped a second
 *    time by §5 section_share_max (35%) — never binds given the §1 caps,
 *    but kept per spec.
 *  - §5 homepage.max_items (20) total, across lead + recent + columns.
 *  - Google News items flagged metadata.sectionOnly (§2 "Google News
 *    handling") are excluded; section pages still list them.
 * Skipped items are never replaced with padding: a slot that runs out of
 * eligible articles is just left shorter than its usual capacity.
 */
export function buildHomepageSections(articles = [], { now = Date.now(), onDrop } = {}) {
  const { fresh } = splitByFreshness(articles, { now });

  const shown = new Set();
  const perSourceCount = new Map();
  const perSpecSectionCount = new Map();
  let totalCount = 0;

  const eligible = (article) => {
    if (totalCount >= HOMEPAGE_MAX_ITEMS) { onDrop?.(article, { stage: "total_cap" }); return false; }
    if (article.metadata?.sectionOnly) { onDrop?.(article, { stage: "section_only" }); return false; }
    if (shown.has(canonicalizeUrl(article.url))) return false;
    const homeCap = SOURCE_BY_ID.get(article.sourceId)?.homeCap ?? DEFAULT_HOME_CAP_PER_SOURCE;
    if ((perSourceCount.get(article.sourceId) || 0) >= homeCap) { onDrop?.(article, { stage: "home_cap" }); return false; }
    const specSection = homepageSectionOf(article);
    if (specSection) {
      const sectionCap = Math.min(SECTION_HOMEPAGE_CAPS[specSection] ?? Infinity, SECTION_SHARE_CAP);
      if ((perSpecSectionCount.get(specSection) || 0) >= sectionCap) { onDrop?.(article, { stage: "section_cap", specSection }); return false; }
    }
    return true;
  };
  const take = (article) => {
    shown.add(canonicalizeUrl(article.url));
    perSourceCount.set(article.sourceId, (perSourceCount.get(article.sourceId) || 0) + 1);
    const specSection = homepageSectionOf(article);
    if (specSection) perSpecSectionCount.set(specSection, (perSpecSectionCount.get(specSection) || 0) + 1);
    totalCount += 1;
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
  const categories = ranked?.relevance?.map((match) => match.category) || [];
  // sources-spec.md §1: "If the AI section and the rules section disagree,
  // use the rules section when it has >=2 keyword hits." tenders-contracts/
  // regulators-policy have no rule above, so this is the only way an
  // article gets the "tenders"/"regulators" category — promoted to primary
  // (categories[0]) when it qualifies, keeping the rest of the categories.
  const override = rulesOverrideCategory({ title: row.title, summary: row.summary, categories });
  return {
    ...row,
    categories: override ? [override, ...categories.filter((category) => category !== override)] : categories,
    relevance: ranked?.relevance || [],
    score: ranked?.score || 0,
  };
}
