import { getSql } from "./database.js";
import { collapseDuplicateArticles, cleanTitleForSource } from "./article-quality.js";
import { DEFAULT_WATCH_RULES, rankItems } from "./watch-rules.js";
import { storyDateToIso } from "./story-date.js";
import { canonicalizeUrl } from "./sources/utils.js";
import { isGoogleNewsUrl } from "./google-news.js";
import { SOURCES } from "../config/sources.js";
import {
  BACKFILL_MAX_AGE_HOURS,
  DEFAULT_DAY_CAP_PER_SOURCE,
  DEFAULT_HOME_CAP_PER_SOURCE,
  HOMEPAGE_BACKFILL_MIN_ITEMS,
  HOMEPAGE_MAX_ITEMS,
  SECTION_HOMEPAGE_CAPS,
  SECTION_NAV_WINDOW_DAYS,
  SECTION_SHARE_CAP,
  athensDayKey,
  hasFigureOrDecisionSignal,
  hasTelecomNetworkAngle,
  hasTier1ActionWord,
  homepageSectionOf,
  isAgendaItem,
  isCyprusOnly,
  isDealsEligible,
  isEventPiece,
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
  let cleaned = deduped.map(reclassifyRow)
    .flatMap((row) => dropTelcoWithoutNetworkAngle(row, onDrop))
    .flatMap((row) => dropDealsWithoutCompany(row, onDrop));
  if (category) {
    cleaned = cleaned.filter((row) => row.categories.includes(category));
    cleaned = enforceEventCapPerSection(cleaned, onDrop);
  }
  return cleaned.slice(0, limit).map(toArticle);
}

// round-4 telco rule: telecom-fibre is only a valid category when the item
// actually names a network/technology angle or operator (hasTelecomNetworkAngle)
// — a "telecommunications company" story that never gets more specific than
// that (e.g. a generic AI-tools piece from a telco, a consumer-gadget piece)
// loses the telco category, and is dropped outright if it had no other one.
function dropTelcoWithoutNetworkAngle(row, onDrop) {
  if (!row.categories.includes("telco")) return [row];
  if (hasTelecomNetworkAngle(`${row.title || ""} ${row.summary || ""}`)) return [row];
  const categories = row.categories.filter((c) => c !== "telco");
  if (!categories.length) {
    onDrop?.(row, { stage: "telco_no_network_angle" });
    return [];
  }
  return [{ ...row, categories }];
}

// round-5 deals-companies gating: an item may carry "deals" only when
// isDealsEligible holds (a sector company name is enough on its own; the
// narrower exception is "αποτελέσματα" with no other deal word, which needs
// the company specifically in the title) — both the DEFAULT_WATCH_RULES
// deals-companies rule and tier-1 topical routing can assign the category
// before this gate runs, so it is enforced once here regardless of origin.
// If "deals" was the only category, the item is dropped entirely
// (deals_no_company); otherwise its other categories are kept.
function dropDealsWithoutCompany(row, onDrop) {
  if (!row.categories.includes("deals")) return [row];
  if (isDealsEligible(row)) return [row];
  const categories = row.categories.filter((c) => c !== "deals");
  if (!categories.length) {
    onDrop?.(row, { stage: "deals_no_company" });
    return [];
  }
  return [{ ...row, categories }];
}

// round-4 event rule, section-page half: at most one event piece per
// section page — keep the highest-scoring (ties: newest), drop the rest.
function enforceEventCapPerSection(rows, onDrop) {
  const eventRows = rows.filter((row) => isEventPiece(row.title));
  if (eventRows.length <= 1) return rows;
  const [keep] = [...eventRows].sort((a, b) =>
    (b.score || 0) - (a.score || 0) || Date.parse(b.published_at || 0) - Date.parse(a.published_at || 0));
  const dropUrls = new Set(eventRows.filter((row) => row !== keep).map((row) => row.canonical_url));
  for (const row of rows) {
    if (dropUrls.has(row.canonical_url)) onDrop?.(row, { stage: "event_cap" });
  }
  return rows.filter((row) => !dropUrls.has(row.canonical_url));
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

// round-4 §7: /tenders and /regulators are hidden from nav/sitemap until
// their section has >=3 items in the last SECTION_NAV_WINDOW_DAYS (30) days
// — pure, so scripts/review-dump.js can compute the same thing from a
// fresh (DB-less) scan. Pages still resolve either way; this only drives
// whether links to them are shown.
export function computeNavVisibility(articles = [], { now = Date.now() } = {}) {
  const countInWindow = (slug) => articles.filter((article) =>
    article.categories?.includes(slug) && isFresh(article, now, SECTION_NAV_WINDOW_DAYS * 24)).length;
  const build = (slug) => {
    const count = countInWindow(slug);
    return { shown: count >= 3, count };
  };
  return { tenders: build("tenders"), regulators: build("regulators") };
}

/**
 * DB-backed wrapper of computeNavVisibility; getLatestArticles already
 * returns [] with no DATABASE_URL, so both links are hidden. A read failure
 * is swallowed (hidden, not thrown): this runs in the shared public layout
 * on every page, and a nav-visibility hiccup must not take the whole site
 * down the way a real page-content read failure legitimately would.
 */
export async function getNavVisibility({ now = Date.now() } = {}) {
  try {
    const articles = await getLatestArticles({ limit: 300 });
    return computeNavVisibility(articles, { now });
  } catch {
    return computeNavVisibility([], { now });
  }
}

/**
 * Lays out the homepage without repeating an article across sections. Each
 * article is placed once: as the lead, in "recent", or in the column for its
 * single highest-scoring category (categories[0], already rank-ordered by
 * rankItems). Section pages still list every matching article separately.
 *
 * Also enforces, across lead + recent + columns together:
 *  - sources-spec.md §3 max_age_hours.news: only items published within the
 *    last 72h are homepage-eligible (items with no publishedAt never are) —
 *    EXCEPT round-4's backfill: whenever fewer than HOMEPAGE_BACKFILL_MIN_ITEMS
 *    (12) items actually end up on the homepage after all caps/rules below
 *    (not just when fewer than 12 are <72h old — a well-supplied fresh set
 *    can still be whittled down under 12 by home_cap/section caps/event/Cyprus
 *    rules), items up to BACKFILL_MAX_AGE_HOURS (7 days) old fill the
 *    remainder, highest-scoring first (ties: newest), marked
 *    `homepageBackfill: true`. Backfill items still go through every other
 *    rule/cap below.
 *  - §2 home_cap per source (default DEFAULT_HOME_CAP_PER_SOURCE).
 *  - §1 homepage_cap per spec section (SECTION_HOMEPAGE_CAPS, keyed by
 *    homepageSectionOf(article) — the article's primary *spec* section,
 *    which can differ from its public-category column), capped a second
 *    time by §5 section_share_max (35%) — never binds given the §1 caps,
 *    but kept per spec.
 *  - §5 homepage.max_items (20) total, across lead + recent + columns.
 *  - Google News items flagged metadata.sectionOnly (§2 "Google News
 *    handling") are excluded; section pages still list them.
 *  - round-4 event rule: an event/conference piece (isEventPiece) never
 *    appears on the homepage unless its title/summary also carries a figure
 *    or decision word (hasFigureOrDecisionSignal) — and even then it can
 *    never be the lead.
 *  - round-4 Cyprus-only rule: an item about Cyprus with no Greece/Greek
 *    mention (isCyprusOnly) never appears on the homepage.
 * Skipped items are never replaced with padding: a slot that runs out of
 * eligible articles is just left shorter than its usual capacity.
 */
export function buildHomepageSections(articles = [], { now = Date.now(), onDrop } = {}) {
  const { fresh, older } = splitByFreshness(articles, { now });
  // Always computed, not just when fresh.length < 12: caps/rules below (home_cap,
  // section caps, event/Cyprus rules) routinely shrink a 30+-item fresh set down
  // to well under 12 shown, and the backfill fill loop further down needs this
  // pool regardless of how many fresh items existed going in.
  const backfillPool = older
    .filter((article) => isFresh(article, now, BACKFILL_MAX_AGE_HOURS))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .map((article) => ({ ...article, homepageBackfill: true }));

  const shown = new Set();
  const perSourceCount = new Map();
  const perSpecSectionCount = new Map();
  let totalCount = 0;

  // round-4 item 8 fix: buildHomepageSections probes eligibility for the
  // same not-yet-shown article across multiple passes (lead, recent,
  // columns, backfill); only the first drop reason per (url, stage) is ever
  // reported, so a home_cap (or any other) drop no longer appears twice for
  // one article.
  const reportedDropKeys = new Set();
  const reportDrop = (article, reason) => {
    if (!onDrop) return;
    const key = `${canonicalizeUrl(article.url)}|${reason.stage}`;
    if (reportedDropKeys.has(key)) return;
    reportedDropKeys.add(key);
    onDrop(article, reason);
  };

  // Pure (no onDrop side effect): used both by eligible() below and to scan
  // for the best lead candidate without reporting a "drop" for every
  // non-chosen candidate (they are still reconsidered for recent/columns).
  const checkEligible = (article, { forLead = false } = {}) => {
    if (totalCount >= HOMEPAGE_MAX_ITEMS) return { ok: false, stage: "total_cap" };
    if (article.metadata?.sectionOnly) return { ok: false, stage: "section_only" };
    if (isCyprusOnly(article)) return { ok: false, stage: "cyprus_only" };
    // round-5: agenda items (any tier) are checked before the tier-1
    // action-word gate below — agenda overrides a tier-1 action word per
    // feed-rules.js isAgendaItem, so its "agenda_item" reason must win over
    // "tier1_no_action" when both would otherwise apply.
    if (isAgendaItem(article.title)) return { ok: false, stage: "agenda_item" };
    const tier = SOURCE_BY_ID.get(article.sourceId)?.tier;
    if (tier === 1 && !hasTier1ActionWord(article.title)) return { ok: false, stage: "tier1_no_action" };
    if (isEventPiece(article.title)) {
      if (forLead) return { ok: false, stage: "event_piece_lead" };
      if (!hasFigureOrDecisionSignal(`${article.title || ""} ${article.summary || ""}`)) {
        return { ok: false, stage: "event_piece" };
      }
    }
    const homeCap = SOURCE_BY_ID.get(article.sourceId)?.homeCap ?? DEFAULT_HOME_CAP_PER_SOURCE;
    if ((perSourceCount.get(article.sourceId) || 0) >= homeCap) return { ok: false, stage: "home_cap" };
    const specSection = homepageSectionOf(article);
    if (specSection) {
      const sectionCap = Math.min(SECTION_HOMEPAGE_CAPS[specSection] ?? Infinity, SECTION_SHARE_CAP);
      if ((perSpecSectionCount.get(specSection) || 0) >= sectionCap) {
        return { ok: false, stage: "section_cap", specSection };
      }
    }
    return { ok: true };
  };
  const eligible = (article, options) => {
    const result = checkEligible(article, options);
    if (!result.ok) reportDrop(article, { stage: result.stage, ...(result.specSection ? { specSection: result.specSection } : {}) });
    return result.ok;
  };
  const take = (article) => {
    shown.add(canonicalizeUrl(article.url));
    perSourceCount.set(article.sourceId, (perSourceCount.get(article.sourceId) || 0) + 1);
    const specSection = homepageSectionOf(article);
    if (specSection) perSpecSectionCount.set(specSection, (perSpecSectionCount.get(specSection) || 0) + 1);
    totalCount += 1;
    return article;
  };

  // round-4 lead rule: never an event piece (not even with a figure/decision
  // word — forLead always rejects); prefer Tier 1/3 sources and items whose
  // title/summary carries a figure or decision word; fresh items first,
  // falling back to the backfill pool only when no fresh item is eligible.
  let lead = null;
  const freshLeadCandidates = fresh.filter((article) => checkEligible(article, { forLead: true }).ok);
  const leadCandidates = freshLeadCandidates.length
    ? freshLeadCandidates
    : backfillPool.filter((article) => checkEligible(article, { forLead: true }).ok);
  if (leadCandidates.length) {
    const [best] = [...leadCandidates].sort((a, b) => {
      const preferenceDiff = leadPreferenceScore(b) - leadPreferenceScore(a);
      if (preferenceDiff) return preferenceDiff;
      return (b.score || 0) - (a.score || 0) || Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0);
    });
    lead = take(best);
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

  // round-4 homepage backfill: every fresh article has already been offered
  // a slot above (lead/recent/columns); top up from the up-to-7-day-old
  // backfill pool whenever that left totalCount under the 12-item floor —
  // whether because too few fresh items existed, or because caps/rules
  // thinned out a large fresh set.
  for (const article of backfillPool) {
    if (totalCount >= HOMEPAGE_BACKFILL_MIN_ITEMS) break;
    if (shown.has(canonicalizeUrl(article.url))) continue;
    if (eligible(article)) recent.push(take(article));
  }

  return { lead, recent, columns };
}

// round-4 lead-preference scoring: Tier 1/3 sources and a figure/decision
// word in the title/summary make an item a better lead candidate, but never
// override the hard caps/event/Cyprus rules in checkEligible above.
function leadPreferenceScore(article) {
  let score = 0;
  const tier = SOURCE_BY_ID.get(article.sourceId)?.tier;
  if (tier === 1 || tier === 3) score += 2;
  if (hasFigureOrDecisionSignal(`${article.title || ""} ${article.summary || ""}`)) score += 1;
  return score;
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
    tier: SOURCE_BY_ID.get(row.source_id)?.tier,
    metadata: row.metadata || {},
  }], DEFAULT_WATCH_RULES);
  const categories = ranked?.relevance?.map((match) => match.category) || [];
  // sources-spec.md §1: "If the AI section and the rules section disagree,
  // use the rules section when it has >=2 keyword hits." tenders-contracts/
  // regulators-policy have no rule above, so this is the only way an
  // article gets the "tenders"/"regulators" category — promoted to primary
  // (categories[0]) when it qualifies, keeping the rest of the categories.
  const override = rulesOverrideCategory({ title: row.title, summary: row.summary, categories });
  let finalCategories = override ? [override, ...categories.filter((category) => category !== override)] : categories;
  // round-5 agenda rule: applies to every tier, not just the tier-1 forced
  // routing above. Agenda items belong on /regulators ONLY — never on their
  // topical section (e.g. /infrastructure, /energy) or the homepage — so the
  // category list is replaced outright, not appended to. This runs last and
  // produces the row's final categories, so it survives the later
  // dropTelcoWithoutNetworkAngle/dropDealsWithoutCompany gates unaffected
  // (neither "telco" nor "deals" remains for them to act on).
  if (isAgendaItem(row.title)) {
    finalCategories = ["regulators"];
  }
  return {
    ...row,
    categories: finalCategories,
    relevance: ranked?.relevance || [],
    score: ranked?.score || 0,
  };
}
