import { createSourceAdapter } from "./sources/index.js";
import { DEFAULT_WATCH_RULES, rankItems } from "./watch-rules.js";
import { inspectArticle, validateArticleLink } from "./agents/source-guardian.js";
import { readArticles } from "./agents/article-reader.js";

export async function scanMarket({
  sources,
  rules = DEFAULT_WATCH_RULES,
  fetch,
  concurrency = 4,
  validateLinks = false,
  validationLimit = 40,
  readArticlePages = false,
  articleReadLimit = 60,
}) {
  if (!Array.isArray(sources) || !sources.length) throw new TypeError("At least one source is required");
  const outcomes = [];

  for (let index = 0; index < sources.length; index += concurrency) {
    const batch = sources.filter((source) => source.enabled !== false).slice(index, index + concurrency);
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
    const sourceRanked = rankItems(result.value.items, rules);
    status.push({
      id: source.id || source.url,
      ok: true,
      fetched: result.value.items.length,
      accepted: sourceRanked.length,
      rejected: result.value.items.length - sourceRanked.length,
    });
    for (const item of result.value.items) {
      const url = canonicalUrl(item.url);
      if (!byUrl.has(url)) byUrl.set(url, { ...item, sourceId: source.id || source.url });
    }
  }

  let discoveredItems = [...byUrl.values()];
  if (readArticlePages && discoveredItems.length) {
    discoveredItems = await readArticles(discoveredItems, {
      fetch: fetch || globalThis.fetch,
      limit: articleReadLimit,
    });
  }

  const candidates = discoveredItems
    .map((item) => ({ ...item, validation: inspectArticle(item, { rules }) }))
    .filter((item) => item.validation.accepted);

  if (validateLinks && candidates.length) {
    const candidatesToCheck = candidates
      .sort((a, b) => b.validation.subject.score - a.validation.subject.score)
      .slice(0, validationLimit);
    const checked = await Promise.all(candidatesToCheck.map(async (item) => ({
      item,
      link: await validateArticleLink(item, { fetch: fetch || globalThis.fetch }),
    })));
    const checksByUrl = new Map(checked.map(({ item, link }) => [item.url, link]));
    for (const item of candidates) {
      const link = checksByUrl.get(item.url);
      if (link) item.validation = { ...item.validation, url: { ...item.validation.url, ...link } };
    }
  }

  const ranked = rankItems(candidates, rules).map((item) => ({
    ...item,
    metadata: {
      ...(item.metadata || {}),
      validation: item.validation,
    },
  }));
  return {
    scannedAt: new Date().toISOString(),
    sources: status,
    fetched: [...byUrl.values()].length,
    relevant: ranked.length,
    items: ranked,
  };
}

function canonicalUrl(value) {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  }
  return url.href;
}
