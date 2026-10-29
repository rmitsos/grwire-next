/**
 * A fresh, no-database "what would the site show" dump: runs scanMarket
 * over the network (like scripts/scan.js), then runs the scanned items
 * through the exact same selection code the live site uses
 * (src/public-data.js selectArticles/buildHomepageSections) and writes the
 * result as JSON to argv[2].
 *
 * This script never touches a database. src/public-data.js is imported
 * only for its pure selection helpers — neither selectArticles nor
 * buildHomepageSections ever calls its lazily-created getSql() — and
 * DATABASE_URL is cleared below so that stays true even if the environment
 * this runs in happens to set one.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SOURCES } from "../config/sources.js";
import { scanMarket } from "../src/pipeline.js";
import { selectArticles, buildHomepageSections, computeNavVisibility, homepageBackfillIneligibleReason, homepageBackfillWindowHours, PUBLIC_CATEGORIES } from "../src/public-data.js";
import {
  HOMEPAGE_MAX_ITEMS,
  SECTION_HOMEPAGE_CAPS,
  MAX_AGE_HOURS_NEWS,
  HOMEPAGE_TARGET_ITEMS,
  HOMEPAGE_FRESH_MIN_SCORE,
  DEFAULT_DAY_CAP_PER_SOURCE,
  DEFAULT_HOME_CAP_PER_SOURCE,
  hasFigureOrDecisionSignal,
  homepageSectionOf,
  isFresh,
  splitByFreshness,
} from "../src/feed-rules.js";

delete process.env.DATABASE_URL;

const SOURCE_BY_ID = new Map(SOURCES.map((source) => [source.id, source]));

/** scanMarket item -> the same row shape ingest-service.js writes to the DB. */
export function toRow(item, index) {
  return {
    id: index,
    canonical_url: item.url,
    title: item.title,
    summary: item.summary || null,
    published_at: item.publishedAt || null,
    source_id: item.sourceId || null,
    source_url: item.originalUrl || item.url,
    score: item.score || 0,
    categories: [...new Set((item.relevance || []).map((match) => match.category))],
    relevance: item.relevance || [],
    metadata: item.metadata || {},
  };
}

/** Europe/Athens local wall-clock time, ISO-shaped, with its UTC offset (handles EET/EEST). */
export function toAthensIso(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Athens",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23", timeZoneName: "shortOffset",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  const offsetHours = Math.abs(Number(parts.timeZoneName.replace("GMT", "") || "0"));
  const sign = parts.timeZoneName.includes("-") ? "-" : "+";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${sign}${String(offsetHours).padStart(2, "0")}:00`;
}

function toOutputItem(article) {
  const source = SOURCE_BY_ID.get(article.sourceId);
  return {
    title: article.title,
    url: article.url,
    source: { id: article.sourceId || null, name: source?.name || article.sourceId || null },
    publishedAt: article.publishedAt ? toAthensIso(new Date(article.publishedAt)) : null,
    sections: article.categories,
    homepageSection: homepageSectionOf(article),
    score: article.score,
    sectionOnly: Boolean(article.metadata?.sectionOnly),
  };
}

// Homepage items (and only homepage items) additionally carry whether they
// were filled in by the backfill rule (homepageBackfillTier1: a 21-day tier-1 one) — kept off the plain
// toOutputItem shape so the sections-page item key list (tested exactly in
// review-dump.test.js) does not change.
function toHomepageOutputItem(article) {
  return {
    ...toOutputItem(article),
    homepageBackfill: Boolean(article.homepageBackfill),
    homepageBackfillTier1: Boolean(article.homepageBackfillTier1),
  };
}

// round-4: a short explanation of why the chosen lead won (tier preference,
// figure/decision signal, backfill), for the dump's "lead-selection info"
// requirement — mirrors src/public-data.js leadPreferenceScore without
// importing a private helper.
function describeLeadReason(article) {
  if (!article) return null;
  const source = SOURCE_BY_ID.get(article.sourceId);
  const tier = source?.tier ?? null;
  return {
    sourceId: article.sourceId || null,
    tier,
    preferredTier: tier === 1 || tier === 3,
    hasFigureOrDecisionSignal: hasFigureOrDecisionSignal(`${article.title || ""} ${article.summary || ""}`),
    homepageBackfill: Boolean(article.homepageBackfill),
    homepageBackfillTier1: Boolean(article.homepageBackfillTier1),
    score: article.score,
  };
}

function buildPerSourceReport(report, homepage, dropped) {
  const shownOnHomepage = new Map();
  const count = (article) => shownOnHomepage.set(article.sourceId, (shownOnHomepage.get(article.sourceId) || 0) + 1);
  if (homepage.lead) count(homepage.lead);
  homepage.recent.forEach(count);
  Object.values(homepage.columns).flat().forEach(count);

  const droppedByStageBySource = new Map();
  for (const drop of dropped) {
    const bySource = droppedByStageBySource.get(drop.sourceId) || {};
    bySource[drop.reason.stage] = (bySource[drop.reason.stage] || 0) + 1;
    droppedByStageBySource.set(drop.sourceId, bySource);
  }

  return report.sources.map((source) => ({
    id: source.id,
    name: SOURCE_BY_ID.get(source.id)?.name || source.id,
    fetched: source.fetched || 0,
    kept: source.accepted || 0,
    capped: source.dayCapped || 0,
    noiseRejected: source.noiseRejected || 0,
    shownOnHomepage: shownOnHomepage.get(source.id) || 0,
    droppedByStage: droppedByStageBySource.get(source.id) || {},
    error: source.ok ? null : source.error || null,
  }));
}

/**
 * Pure transform: a scanMarket() report -> the JSON this script writes.
 * No network, no DB — takes an already-fetched report (real or a fixture).
 * `scanDrops` is the list of `{ item, reason }` pairs collected via
 * scanMarket's optional `onDrop` callback (noise/relevance_rejected/
 * no_category/day_cap/run_cap/link_invalid/max_relevant) — items dropped
 * before ever reaching `report.items`, so they would otherwise never show
 * up in this dump at all (the root cause the round-4 brief calls out for
 * ΡΑΑΕΥ/ΥΠΕΝ/ΓΓΤΤ).
 */
export function buildReviewDump(report, { now = Date.now(), branch = null, commit = null, scanDrops = [] } = {}) {
  const dropped = [];
  const reportedDropKeys = new Set();
  const recordDrop = (item, reason) => {
    const url = item.canonical_url || item.url;
    const key = `${url}|${reason.stage}`;
    if (reportedDropKeys.has(key)) return;
    reportedDropKeys.add(key);
    dropped.push({ title: item.title, url, sourceId: item.source_id || item.sourceId, reason });
  };

  for (const { item, reason } of scanDrops) recordDrop(item, reason);

  const rows = report.items.map((item, index) => toRow(item, index));

  // Pass 1: every noise/day_cap/duplicate/telco_no_network_angle drop
  // across the FULL scanned set, not just the limit:100 slice the site
  // reads for any single view — otherwise an item dropped only because it
  // fell outside that slice would look like a noise/dedupe drop when it
  // isn't one.
  const allArticles = selectArticles(rows, {
    limit: Number.MAX_SAFE_INTEGER,
    now,
    onDrop: recordDrop,
  });

  // Pass 2: production-faithful reads, same calls/limits as
  // getHomepageData() and the [category] page. buildHomepageSections runs
  // FIRST so a backfilled (>72h but <=7d old; <=21d for tier-1 action-word
  // items) article that does land on the homepage is never also recorded as
  // dropped: only items that didn't make the homepage get a reason below, and
  // "stale" is reserved for items outside even their backfill window (or with
  // no date) — a non-shown item inside that window got either a specific
  // cap/rule reason from buildHomepageSections' onDrop already, or
  // "backfill_ineligible" (an agenda/event item, or scored under its age
  // band's backfill floor), or (if the 10-item target was reached without
  // needing it) "backfill_not_needed".
  const homepageArticles = selectArticles(rows, { limit: 100, now });
  const homepage = buildHomepageSections(homepageArticles, { now, onDrop: recordDrop });
  const shownUrls = new Set(
    [homepage.lead, ...homepage.recent, ...Object.values(homepage.columns).flat()]
      .filter(Boolean).map((article) => article.url),
  );
  for (const article of homepageArticles) {
    if (shownUrls.has(article.url)) continue;
    if (!isFresh(article, now, homepageBackfillWindowHours(article))) {
      recordDrop(article, { stage: "stale" });
    } else if (!dropped.some((drop) => drop.url === article.url)) {
      const ineligible = homepageBackfillIneligibleReason(article, now);
      recordDrop(article, ineligible
        ? { stage: "backfill_ineligible", reason: ineligible }
        : { stage: "backfill_not_needed" });
    }
  }

  const sections = {};
  for (const slug of Object.keys(PUBLIC_CATEGORIES)) {
    // event_cap (max 1 event piece per section page) only triggers once a
    // `category` is passed in, so this per-section call (with onDrop) is
    // also what surfaces it in the dump.
    const sectionArticles = selectArticles(rows, { category: slug, limit: 100, now, onDrop: recordDrop });
    const { fresh, older } = splitByFreshness(sectionArticles, { now });
    sections[slug] = { fresh: fresh.map(toOutputItem), older: older.map(toOutputItem) };
  }

  const navVisibility = computeNavVisibility(allArticles, { now });

  return {
    header: {
      generatedAt: toAthensIso(new Date(now)),
      note: `Generated from a fresh scan run WITHOUT a database on ${toAthensIso(new Date(now))}; `
        + "this is NOT the production database that the Vercel preview reads, so items, counts and "
        + "ordering will differ from the preview.",
      branch,
      commit,
      rules: {
        homepageMaxItems: HOMEPAGE_MAX_ITEMS,
        homepageTargetItems: HOMEPAGE_TARGET_ITEMS,
        homepageFreshMinScore: HOMEPAGE_FRESH_MIN_SCORE,
        maxAgeHoursNews: MAX_AGE_HOURS_NEWS,
        sectionHomepageCaps: SECTION_HOMEPAGE_CAPS,
        defaultDayCapPerSource: DEFAULT_DAY_CAP_PER_SOURCE,
        defaultHomeCapPerSource: DEFAULT_HOME_CAP_PER_SOURCE,
      },
    },
    homepage: {
      lead: homepage.lead ? toHomepageOutputItem(homepage.lead) : null,
      leadReason: describeLeadReason(homepage.lead),
      recent: homepage.recent.map(toHomepageOutputItem),
      columns: Object.fromEntries(
        Object.entries(homepage.columns).map(([slug, items]) => [slug, items.map(toHomepageOutputItem)]),
      ),
    },
    sections,
    dropped,
    perSource: buildPerSourceReport(report, homepage, dropped),
    navVisibility,
  };
}

async function gitRevParse(args) {
  try {
    const { execFileSync } = await import("node:child_process");
    const cwd = fileURLToPath(new URL("..", import.meta.url));
    return execFileSync("git", ["rev-parse", ...args], { cwd, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    process.stderr.write("Usage: node scripts/review-dump.js <output.json> [commit]\n");
    process.exitCode = 1;
    return;
  }
  const branch = process.env.GIT_BRANCH || (await gitRevParse(["--abbrev-ref", "HEAD"]));
  const commit = process.argv[3] || process.env.GIT_COMMIT || (await gitRevParse(["HEAD"]));
  try {
    const scanDrops = [];
    const report = await scanMarket({ sources: SOURCES, onDrop: (item, reason) => scanDrops.push({ item, reason }) });
    const dump = buildReviewDump(report, { now: Date.now(), branch, commit, scanDrops });
    writeFileSync(outPath, `${JSON.stringify(dump, null, 2)}\n`);
    process.stdout.write(`Wrote ${outPath}\n`);
  } catch (error) {
    process.stderr.write(`review-dump failed: ${error?.message || error}\n`);
    process.exitCode = 1;
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) await main();
