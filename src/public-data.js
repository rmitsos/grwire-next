import { getSql } from "./database.js";
import { collapseDuplicateArticles, cleanTitleForSource } from "./article-quality.js";
import { DEFAULT_WATCH_RULES, rankItems } from "./watch-rules.js";
import { storyDateToIso } from "./story-date.js";
import { canonicalizeUrl } from "./sources/utils.js";
import { cleanOutgoingLink, publicSourceName, readFeedSummary } from "./public-links.js";
import { SOURCES } from "../config/sources.js";
import {
  BACKFILL_MAX_AGE_HOURS,
  BACKFILL_MIN_SCORE,
  TIER1_BACKFILL_MAX_AGE_HOURS,
  TIER1_BACKFILL_MIN_SCORE,
  DEFAULT_DAY_CAP_PER_SOURCE,
  DEFAULT_HOME_CAP_PER_SOURCE,
  HOMEPAGE_TARGET_ITEMS,
  HOMEPAGE_FRESH_MIN_SCORE,
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
// The category-independent half of the read-time rules (noise, day cap, duplicates, telco/deals
// gating). Expensive on a full 300-row read, so callers that need several categories run it once.
function prepareRows(rows, { now = Date.now(), onDrop } = {}) {
  const withoutNoise = rows.filter((row) => {
    const reason = noiseRejectReason(row);
    if (!reason) return true;
    onDrop?.(row, { stage: "noise", ...reason });
    return false;
  });
  const displayable = withoutNoise.filter((row) => {
    const stage = undisplayableStage(row);
    if (!stage) return true;
    onDrop?.(row, { stage });
    return false;
  });
  const dayCapped = applyDayCap(displayable, { now, onDrop: (row) => onDrop?.(row, { stage: "day_cap" }) });
  const deduped = collapseDuplicateArticles(dayCapped, { onDrop: (row) => onDrop?.(row, { stage: "duplicate" }) });
  return deduped.map(reclassifyRow)
    .flatMap((row) => dropTelcoWithoutNetworkAngle(row, onDrop))
    .flatMap((row) => dropDealsWithoutCompany(row, onDrop))
    .filter((row) => {
      // round-7: the rules (read-time reclassification) found no category at all — e.g. the
      // water/sewage negative removed the only match — so there is nothing to place it under.
      if (row.categories.length) return true;
      onDrop?.(row, { stage: "no_category" });
      return false;
    });
}

// round-7 display gates that need no ranking, applied to stored rows at read time:
//  - undated: a row with no (parseable) publish date is never shown (the DB read orders by
//    COALESCE(published_at, updated_at), so such rows used to float among today's items);
//  - google_news_unresolved: a news.google.com redirect that cannot be resolved to the
//    publisher URL (the same cleanOutgoingLink the homepage uses) is not shown on any page.
function undisplayableStage(row) {
  const published = row.published_at ? new Date(row.published_at).getTime() : NaN;
  if (Number.isNaN(published)) return "undated";
  if (cleanOutgoingLink(row.canonical_url, row.metadata).viaGoogleNews) return "google_news_unresolved";
  return null;
}

function pickRows(prepared, { category, limit = 80, onDrop } = {}) {
  let cleaned = prepared;
  if (category) {
    cleaned = cleaned.filter((row) => row.categories.includes(category));
    cleaned = enforceEventCapPerSection(cleaned, onDrop);
  }
  return cleaned.slice(0, limit).map(toArticle);
}

export function selectArticles(rows, { category, limit = 80, now = Date.now(), onDrop } = {}) {
  return pickRows(prepareRows(rows, { now, onDrop }), { category, limit, onDrop });
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

const RECENT_ROWS_TTL_MS = 60 * 1000;
const recentRows = new Map();

async function readArticleRows({ query, limit }) {
  const sql = getSql();
  if (!sql) return [];
  const queryLimit = Math.min(Math.max(limit * 3, limit), 300);
  if (query) {
    const pattern = `%${query}%`;
    return sql`
      SELECT * FROM articles
      WHERE title ILIKE ${pattern} OR summary ILIKE ${pattern}
      ORDER BY COALESCE(published_at, updated_at) DESC NULLS LAST LIMIT ${queryLimit}
    `;
  }
  // Every public page reads the same newest rows (the page body and the shared nav both do), so
  // share one in-flight/recent read per process instead of one 300-row query per page. A static
  // build renders dozens of pages at once and otherwise stalls on that many identical queries.
  const hit = recentRows.get(queryLimit);
  if (hit && Date.now() - hit.at < RECENT_ROWS_TTL_MS) return hit.promise;
  const promise = Promise.resolve(sql`
    SELECT * FROM articles
    ORDER BY COALESCE(published_at, updated_at) DESC NULLS LAST LIMIT ${queryLimit}
  `);
  recentRows.set(queryLimit, { at: Date.now(), promise });
  promise.catch(() => { if (recentRows.get(queryLimit)?.promise === promise) recentRows.delete(queryLimit); });
  return promise;
}

export async function getLatestArticles({ category, query, limit = 80 } = {}) {
  try {
    const rows = await readArticleRows({ query, limit });
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
 * DB-backed wrapper of computeNavVisibility. It counts exactly what each section page lists:
 * the same rows (the 300 newest, as for any limit-100 read) run through the same selection with
 * that page's category and limit (selectArticles({ category, limit: 100 }), the call behind
 * getLatestArticles on /tenders and /regulators), so the nav can never promise a page with
 * fewer than 3 items. No DATABASE_URL returns no rows, so both links are hidden. A read failure
 * is swallowed (hidden, not thrown): this runs in the shared public layout on every page, and a
 * nav-visibility hiccup must not take the whole site down the way a real page-content read
 * failure legitimately would.
 */
export function navVisibilityFromRows(rows, { now = Date.now() } = {}) {
  const prepared = prepareRows(rows, { now });
  const articles = ["tenders", "regulators"].flatMap((category) =>
    pickRows(prepared, { category, limit: 100 }));
  return computeNavVisibility(articles, { now });
}

let navCache;

export async function getNavVisibility({ now = Date.now() } = {}) {
  // Every public page renders the shared nav; computing it is a full read-rules pass over the
  // newest rows, so share one result per process for a minute (a static build renders dozens).
  if (navCache && now - navCache.at < RECENT_ROWS_TTL_MS) return navCache.promise;
  const promise = readArticleRows({ limit: 100 }).then((rows) => navVisibilityFromRows(rows, { now }));
  navCache = { at: now, promise };
  try {
    return await promise;
  } catch {
    if (navCache?.promise === promise) navCache = undefined;
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
 *    EXCEPT the backfill (round 4, reworked in round 6): whenever fewer than
 *    HOMEPAGE_TARGET_ITEMS (10) items actually end up on the homepage after
 *    all caps/rules below, older items fill the remainder, highest-scoring
 *    first (ties: newest), marked `homepageBackfill: true`. Items up to
 *    BACKFILL_MAX_AGE_HOURS (7 days) old qualify from score
 *    BACKFILL_MIN_SCORE (10); tier-1 items that pass the action-word gate
 *    (hasTier1ActionWord) qualify up to TIER1_BACKFILL_MAX_AGE_HOURS (21
 *    days) from score TIER1_BACKFILL_MIN_SCORE (20) — those older than 7
 *    days are also marked `homepageBackfillTier1: true`. Agenda items and
 *    event pieces never backfill, and nothing pads below the floors: if
 *    fewer than 10 qualify the slots stay empty. Backfill items still go
 *    through every other rule/cap below.
 *  - round-6b: a fresh item scoring under HOMEPAGE_FRESH_MIN_SCORE (5) is
 *    dropped from the homepage ("below_fresh_floor"); other feeds keep it.
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
  // Always computed, not just when fresh is short: caps/rules below (home_cap,
  // section caps, event/Cyprus rules) routinely shrink a large fresh set to
  // under the target, and the fill loop further down needs this pool
  // regardless of how many fresh items existed going in.
  const backfillPool = older
    .filter(isBackfillCandidate(now))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .map((article) => ({
      ...article,
      homepageBackfill: true,
      ...(isFresh(article, now, BACKFILL_MAX_AGE_HOURS) ? {} : { homepageBackfillTier1: true }),
    }));

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
    // round-6b: a fresh (non-backfill) item under the floor never takes a
    // homepage slot; section pages are unaffected. Backfill items have their
    // own floors (isBackfillCandidate).
    if (!article.homepageBackfill && (article.score || 0) < HOMEPAGE_FRESH_MIN_SCORE) {
      return { ok: false, stage: "below_fresh_floor" };
    }
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

  // homepage backfill (round 4, target 10 / no padding since round 6): every
  // fresh article has already been offered a slot above (lead/recent/
  // columns); top up from the backfill pool only while totalCount is under
  // HOMEPAGE_TARGET_ITEMS — and stop there, leaving any remaining slots empty.
  for (const article of backfillPool) {
    if (totalCount >= HOMEPAGE_TARGET_ITEMS) break;
    if (shown.has(canonicalizeUrl(article.url))) continue;
    if (eligible(article)) recent.push(take(article));
  }

  return { lead, recent, columns };
}

/**
 * Max age (hours) an older article may still be backfilled onto the homepage:
 * 21 days for a tier-1 source's item that passes the action-word gate (formal
 * act: consultation/invitation/decision), 7 days for everything else.
 */
export function homepageBackfillWindowHours(article) {
  const tier = SOURCE_BY_ID.get(article?.sourceId)?.tier;
  return tier === 1 && hasTier1ActionWord(article?.title)
    ? TIER1_BACKFILL_MAX_AGE_HOURS
    : BACKFILL_MAX_AGE_HOURS;
}

// round-6 backfill never pads: agenda items and event pieces never qualify,
// and an item must clear the floor of its own age band — 10 within 7 days,
// 20 (after the action-word boost) for the 8-to-21-day tier-1 band. Returns
// why an article within its age window is kept out of the backfill, or null
// when it qualifies (the review dump reports the reason).
export function homepageBackfillIneligibleReason(article, now = Date.now()) {
  if (isAgendaItem(article.title)) return "agenda_item";
  if (isEventPiece(article.title)) return "event_piece";
  const minScore = isFresh(article, now, BACKFILL_MAX_AGE_HOURS) ? BACKFILL_MIN_SCORE : TIER1_BACKFILL_MIN_SCORE;
  return (article.score || 0) >= minScore ? null : "below_backfill_floor";
}

function isBackfillCandidate(now) {
  return (article) => isFresh(article, now, homepageBackfillWindowHours(article))
    && homepageBackfillIneligibleReason(article, now) === null;
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

// Display-time shaping (nothing is written back): the link is unwrapped from Google News when
// the original URL is in the data and stripped of tracking params, the title loses a trailing
// " - Source" that matches the item's source, and the public source name replaces the internal
// source id. `viaGoogleNews` marks links that still go through news.google.com.
function toArticle(row) {
  const source = SOURCE_BY_ID.get(row.source_id);
  const link = cleanOutgoingLink(row.canonical_url, row.metadata);
  const feed = readFeedSummary(row.title, row.summary);
  const publisher = row.metadata?.publisher || feed.publisher;
  let hostname;
  try { hostname = new URL(link.url).hostname.replace(/^www\./, ""); } catch { hostname = undefined; }
  return {
    id: row.id,
    url: link.url,
    viaGoogleNews: link.viaGoogleNews,
    title: cleanTitleForSource(row.title, [source?.name, hostname, publisher]),
    summary: feed.summary,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    sourceId: row.source_id,
    sourceName: publicSourceName({ publisher, configuredName: source?.name, url: link.url }),
    score: Number(row.score),
    categories: row.categories || [],
    relevance: row.relevance || [],
    // An item is section-only while its link still points at news.google.com (unresolved);
    // a link unwrapped at display time is a normal publisher link.
    metadata: {
      sectionOnly: link.viaGoogleNews,
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
    articleIds: row.article_ids || [],
    evidence: (row.evidence || []).map(toPublicEvidence),
    metadata: row.metadata || {},
  };
}

// Story evidence is stored with internal ids and scores; the public shape carries only what a
// reader sees: a clean link, a clean title and the publisher name.
function toPublicEvidence(item) {
  const source = SOURCE_BY_ID.get(item.sourceId);
  const link = cleanOutgoingLink(item.url, item.metadata);
  let hostname;
  try { hostname = new URL(link.url).hostname.replace(/^www\./, ""); } catch { hostname = undefined; }
  return {
    id: item.id,
    url: link.url,
    viaGoogleNews: link.viaGoogleNews,
    title: cleanTitleForSource(item.title, [source?.name, hostname, item.publisher]),
    publishedAt: item.publishedAt,
    sourceName: publicSourceName({ publisher: item.publisher, configuredName: source?.name, url: link.url }),
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
