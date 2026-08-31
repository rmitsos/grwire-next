import { analyseArticle } from "./market-analyst.js";

/** Build the daily executive layer from a rolling article set. */
export function buildDailyIntelligence({ articles = [], relationships = [], now = new Date(), windowDays = 30 } = {}) {
  const signals = articles.map((article) => analyseArticle(article, article.validation));
  const cutoff = new Date(now).getTime() - windowDays * 86_400_000;
  const recent = signals.filter((signal) => !signal.publishedAt || Date.parse(signal.publishedAt) >= cutoff);
  const trends = detectTrends(recent, signals, { now, windowDays });
  const correlations = detectCorrelations(recent, relationships);
  const watch = buildWatchSituations(trends, correlations);
  return {
    generatedAt: new Date(now).toISOString(),
    trends: trends.slice(0, 6),
    correlations: correlations.slice(0, 8),
    watch: watch.slice(0, 5),
    sourceCount: new Set(recent.map((signal) => signal.sourceId).filter(Boolean)).size,
    articleCount: recent.length,
  };
}

export function detectTrends(recent, allSignals = recent, { now = new Date(), windowDays = 30 } = {}) {
  const buckets = new Map();
  for (const signal of recent) {
    const keys = [...signal.categories, ...signal.topics.filter((topic) => topic.length > 4)];
    for (const key of keys) {
      const bucket = buckets.get(key) || { key, articles: [], sources: new Set(), organisations: new Set(), scores: [] };
      bucket.articles.push(signal);
      if (signal.sourceId) bucket.sources.add(signal.sourceId);
      signal.organisations.forEach((organisation) => bucket.organisations.add(organisation));
      bucket.scores.push(signal.score);
      buckets.set(key, bucket);
    }
  }
  return [...buckets.values()]
    .map((bucket) => {
      const priorCutoff = new Date(now).getTime() - windowDays * 2 * 86_400_000;
      const prior = allSignals.filter((signal) => Date.parse(signal.publishedAt || 0) < priorCutoff && [...signal.categories, ...signal.topics].includes(bucket.key)).length;
      const momentum = bucket.articles.length - prior;
      const confidence = Math.min(0.95, 0.30 + bucket.sources.size * 0.12 + bucket.articles.length * 0.04 + (momentum > 0 ? 0.12 : 0));
      return {
        type: "trend",
        title: `${label(bucket.key)} activity is increasing`,
        subject: bucket.key,
        summary: `${bucket.articles.length} relevant signal${bucket.articles.length === 1 ? "" : "s"} from ${bucket.sources.size || 1} source${bucket.sources.size === 1 ? "" : "s"} in the last ${windowDays} days.`,
        articleIds: bucket.articles.slice(0, 8).map((article) => article.id),
        organisations: [...bucket.organisations].slice(0, 8),
        articleCount: bucket.articles.length,
        momentum,
        confidence,
        horizon: momentum > 1 ? "1-6 months" : "monitor",
      };
    })
    .filter((trend) => trend.articleCount >= 2 || trend.confidence >= 0.55)
    .sort((a, b) => b.confidence - a.confidence || b.momentum - a.momentum);
}

export function detectCorrelations(signals, relationships = []) {
  const results = [];
  for (let left = 0; left < signals.length; left += 1) {
    for (let right = left + 1; right < signals.length; right += 1) {
      const a = signals[left];
      const b = signals[right];
      const sharedOrganisations = intersection(a.organisations, b.organisations);
      const sharedCategories = intersection(a.categories, b.categories);
      const sharedTopics = intersection(a.topics, b.topics);
      const independentSources = a.sourceId && b.sourceId && a.sourceId !== b.sourceId;
      const relationBoost = hasRelationshipPath(sharedOrganisations, relationships) ? 0.18 : 0;
      const strength = Math.min(0.95, (sharedOrganisations.length * 0.24) + (sharedCategories.length * 0.12) + (sharedTopics.length * 0.07) + (independentSources ? 0.14 : 0) + relationBoost);
      if (strength < 0.32) continue;
      results.push({
        type: "correlation",
        title: `Related signals around ${sharedOrganisations[0] || sharedCategories[0] || sharedTopics[0]}`,
        summary: `${a.title} and ${b.title} share ${sharedOrganisations.length ? "organisations" : "market subjects"}${independentSources ? " across independent sources" : ""}.`,
        articleIds: [a.id, b.id],
        sharedOrganisations,
        sharedCategories,
        sharedTopics,
        confidence: strength,
        interpretation: independentSources ? "independent corroboration" : "same-source thematic link",
      });
    }
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

function buildWatchSituations(trends, correlations) {
  return trends.filter((trend) => trend.confidence >= 0.6).slice(0, 3).map((trend) => ({
    type: "watch",
    title: `Watch ${label(trend.subject)} over the next ${trend.horizon}`,
    summary: "This is an evidence-based early signal, not a confirmed forecast.",
    confidence: Math.max(0.35, trend.confidence - 0.12),
    evidence: trend.articleIds,
  })).concat(correlations.filter((item) => item.confidence >= 0.65).slice(0, 2).map((item) => ({
    type: "watch",
    title: item.title,
    summary: "Monitor for a primary announcement, tender or contract that confirms the connection.",
    confidence: Math.max(0.35, item.confidence - 0.10),
    evidence: item.articleIds,
  })));
}

function intersection(a = [], b = []) { const set = new Set(b); return a.filter((value) => set.has(value)); }
function hasRelationshipPath(organisations, relationships) {
  const set = new Set(organisations);
  return relationships.some((relationship) => set.has(relationship.sourceOrganizationId) || set.has(relationship.targetOrganizationId));
}
function label(value) { return String(value || "market").replaceAll("_", " "); }
