import { createSourceAdapter } from "./sources/index.js";
import { canonicalizeUrl, cleanUrl } from "./sources/utils.js";
import { DEFAULT_WATCH_RULES, rankItems, sourceForcedCategories } from "./watch-rules.js";
import { inspectArticle, validateArticleLink } from "./agents/source-guardian.js";
import { readArticles } from "./agents/article-reader.js";
import { collapseDuplicateArticles, cleanTitleForSource } from "./article-quality.js";
import { DEFAULT_DAY_CAP_PER_SOURCE, athensDayKey, noiseRejectReason } from "./feed-rules.js";
import { resolveGoogleNewsItems } from "./google-news.js";

export async function scanMarket({
  sources,
  rules = DEFAULT_WATCH_RULES,
  fetch,
  concurrency = 4,
  validateLinks = false,
  validationLimit = 40,
  readArticlePages = false,
  articleReadLimit = 30,
  // A deployment can override this via the SOURCE_MAX_RELEVANT env var (see
  // src/ingest-service.js), without changing this default.
  maxRelevantItems = 150,
  maxPerSource = 12,
  now = Date.now(),
}) {
  if (!Array.isArray(sources) || !sources.length) throw new TypeError("At least one source is required");
  const outcomes = [];
  const activeSources = sources.filter((source) => source.enabled !== false);

  for (let index = 0; index < activeSources.length; index += concurrency) {
    const batch = activeSources.slice(index, index + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (source) => {
        const adapter = createSourceAdapter(source.type, { fetch });
        return { source, items: await adapter.load(source) };
      }),
    );
    outcomes.push(...settled.map((result, offset) => ({ result, source: batch[offset] })));
  }

  const status = [];
  const byUrl = new Map();
  for (const { result, source } of outcomes) {
    if (result.status === "rejected") {
      status.push({ id: source.id || source.url, ok: false, error: result.reason?.message || String(result.reason) });
      continue;
    }
    status.push({
      id: source.id || source.url,
      ok: true,
      fetched: result.value.items.length,
      accepted: 0,
      rejected: result.value.items.length,
      readFailed: 0,
      validated: 0,
      validLinks: 0,
      invalidLinks: 0,
    });
    for (const item of result.value.items) {
      // Dedupe identity uses the fully canonical URL (lowercase host, no
      // www., no tracking params); the stored URL only lowercases the host
      // and strips tracking params, keeping www./path/trailing slash as
      // published so links keep working on hosts that require them.
      const canonical = canonicalizeUrl(item.url);
      if (!byUrl.has(canonical)) {
        byUrl.set(canonical, { ...item, sourceId: source.id || source.url, url: cleanUrl(item.url), originalUrl: item.url });
      }
    }
  }

  let discoveredItems = [...byUrl.values()];
  if (readArticlePages && discoveredItems.length) {
    // Use the lead metadata as a cheap first pass. Category pages can expose
    // hundreds of links; only read pages whose headline already resembles a
    // configured market subject.
    const preselected = discoveredItems
      .map((item) => ({ item, validation: inspectArticle(item, { rules }) }))
      // Keep a deliberately permissive lead gate. Greek headlines often use
      // an inflected single subject term (for example "κινητής") that scores
      // below the final evidence threshold until the article body is read.
      .filter(({ validation }) => validation.subject.score >= 12)
      .sort((a, b) => b.validation.subject.score - a.validation.subject.score)
      .slice(0, articleReadLimit)
      .map(({ item }) => item);
    // Fetch the publisher's original link (canonical hosts can 404 on sites
    // that require the www. prefix), then restore the canonical identity.
    const readTargets = preselected.map((item) => ({ ...item, url: item.originalUrl || item.url }));
    const readItems = await readArticles(readTargets, {
      fetch: fetch || globalThis.fetch,
      limit: articleReadLimit,
    });
    const readByUrl = new Map(readItems.map((item, index) => [preselected[index].url, item]));
    discoveredItems = discoveredItems.map((item) => {
      const read = readByUrl.get(item.url);
      if (!read) return item;
      return { ...read, url: item.url, originalUrl: item.originalUrl };
    });
  }

  // sources-spec.md §5 noise_hard_reject: dropped before ranking, with the
  // reason counted per source in the scan report.
  const noiseRejectedBySource = new Map();
  const noiseFiltered = discoveredItems.filter((item) => {
    const reason = noiseRejectReason(item);
    if (!reason) return true;
    noiseRejectedBySource.set(item.sourceId, (noiseRejectedBySource.get(item.sourceId) || 0) + 1);
    return false;
  });

  const inspected = collapseDuplicateArticles(noiseFiltered)
    .map((item) => ({ ...item, validation: inspectArticle(item, { rules }) }))
  // sources-spec.md §2.2 ppc-press source-level routing (watch-rules.js
  // sourceForcedCategories) guarantees a category regardless of the generic
  // relevance gate, so those items must not be dropped here either.
  const candidates = inspected.filter((item) => item.validation.accepted || sourceForcedCategories(item).length > 0);

  if (validateLinks && candidates.length) {
    const candidatesToCheck = candidates
      .sort((a, b) => b.validation.subject.score - a.validation.subject.score)
      .slice(0, validationLimit);
    const checked = await Promise.all(candidatesToCheck.map(async (item) => ({
      item,
      link: await validateArticleLink({ ...item, url: item.originalUrl || item.url }, { fetch: fetch || globalThis.fetch }),
    })));
    const checksByUrl = new Map(checked.map(({ item, link }) => [item.url, link]));
    for (const item of candidates) {
      const link = checksByUrl.get(item.url);
      if (link) item.validation = { ...item.validation, url: { ...item.validation.url, ...link } };
    }
  }

  const finalCandidates = candidates.filter((item) => {
    if (!validateLinks) return true;
    return ["reachable", "syntax-valid", "not-checked"].includes(item.validation.url.status);
  });
  // Fresh market coverage must reach storage before older, higher-scoring
  // evergreen items. Keep relevance as the tie-breaker within the same news
  // cycle so the homepage and daily story do not stagnate on old coverage.
  const rankedAll = rankItems(finalCandidates, rules);
  const dayCappedBySource = new Map();
  const perSourceCapped = capPerSource(rankedAll, {
    sources: activeSources,
    maxPerSource,
    now,
    onDayCapDrop: (item) => dayCappedBySource.set(item.sourceId, (dayCappedBySource.get(item.sourceId) || 0) + 1),
  });
  let ranked = perSourceCapped
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0) || b.score - a.score)
    .slice(0, maxRelevantItems)
    .map((item) => {
      const source = activeSources.find((candidate) => candidate.id === item.sourceId);
      let hostname;
      try { hostname = new URL(item.url).hostname.replace(/^www\./, ""); } catch { hostname = undefined; }
      return {
        ...item,
        title: cleanTitleForSource(item.title, [source?.name, hostname, item.metadata?.publisher]),
        metadata: {
          ...(item.metadata || {}),
          validation: item.validation,
        },
      };
    });

  // sources-spec.md §2 "Google News handling": dedupe against direct-source
  // items, or resolve to the publisher URL (bounded to the items that
  // already survived relevance + both caps above).
  ranked = await resolveGoogleNewsItems(ranked, { fetch: fetch || globalThis.fetch });

  const acceptedBySource = new Map();
  const readFailedBySource = new Map();
  const validationBySource = new Map();
  for (const item of ranked) acceptedBySource.set(item.sourceId, (acceptedBySource.get(item.sourceId) || 0) + 1);
  for (const item of discoveredItems) {
    if (item.metadata?.articleReader?.status === "failed") {
      readFailedBySource.set(item.sourceId, (readFailedBySource.get(item.sourceId) || 0) + 1);
    }
  }
  for (const item of candidates) {
    const source = validationBySource.get(item.sourceId) || { validated: 0, validLinks: 0, invalidLinks: 0 };
    source.validated += 1;
    if (["reachable", "syntax-valid", "not-checked"].includes(item.validation.url.status)) source.validLinks += 1;
    else source.invalidLinks += 1;
    validationBySource.set(item.sourceId, source);
  }
  for (const source of status) {
    if (!source.ok) continue;
    source.accepted = acceptedBySource.get(source.id) || 0;
    source.rejected = Math.max(0, source.fetched - source.accepted);
    source.readFailed = readFailedBySource.get(source.id) || 0;
    source.noiseRejected = noiseRejectedBySource.get(source.id) || 0;
    source.dayCapped = dayCappedBySource.get(source.id) || 0;
    Object.assign(source, validationBySource.get(source.id) || {});
  }
  return {
    scannedAt: new Date().toISOString(),
    sources: status,
    fetched: [...byUrl.values()].length,
    relevant: ranked.length,
    items: ranked,
  };
}

// Applied after relevance scoring so a prolific source (ypodomes publishes
// ~100/week) cannot crowd out everything else before the global cap runs.
// `items` is already sorted highest-score-first (then freshest). Two caps
// apply in sequence: sources-spec.md §5/§2 day_cap per source per Europe/
// Athens calendar day (items with no publishedAt count toward the scan
// day), then the existing maxPerSource/maxItems limit as an overall
// per-run ceiling. Both keep each source's highest-ranked items.
function capPerSource(items, { sources = [], maxPerSource = 12, now = Date.now(), onDayCapDrop } = {}) {
  const dayCapBySource = new Map();
  const runLimitBySource = new Map();
  for (const source of sources) {
    if (!source.id) continue;
    dayCapBySource.set(source.id, source.dayCap ?? DEFAULT_DAY_CAP_PER_SOURCE);
    const limit = source.maxPerSource ?? source.maxItems;
    if (limit !== undefined) runLimitBySource.set(source.id, limit);
  }

  const dayCounts = new Map();
  const afterDayCap = items.filter((item) => {
    const key = `${item.sourceId}|${athensDayKey(item.publishedAt, now)}`;
    const cap = dayCapBySource.get(item.sourceId) ?? DEFAULT_DAY_CAP_PER_SOURCE;
    const count = dayCounts.get(key) || 0;
    if (count >= cap) { onDayCapDrop?.(item); return false; }
    dayCounts.set(key, count + 1);
    return true;
  });

  const runCounts = new Map();
  const kept = [];
  for (const item of afterDayCap) {
    const limit = runLimitBySource.get(item.sourceId) ?? maxPerSource;
    const count = runCounts.get(item.sourceId) || 0;
    if (count >= limit) continue;
    runCounts.set(item.sourceId, count + 1);
    kept.push(item);
  }
  return kept;
}
