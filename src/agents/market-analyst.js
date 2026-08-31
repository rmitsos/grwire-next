/**
 * Converts validated articles into structured market signals. The output is
 * intentionally model-friendly: a future LLM can improve narratives while
 * preserving the evidence and scoring produced here.
 */

export function analyseArticle(item, validation = {}) {
  const organisations = unique([
    ...(item.organizations || []),
    ...(item.metadata?.organizations || []),
  ]);
  const categories = unique(item.categories || item.relevance?.map((match) => match.category) || []);
  const topics = unique([
    ...(item.metadata?.topics || []),
    ...(item.relevance || []).flatMap((match) => match.reasons || []),
  ]);
  return {
    id: item.id || item.url,
    title: item.title,
    url: item.url,
    publishedAt: item.publishedAt || item.published_at || null,
    sourceId: item.sourceId || item.source_id || null,
    organisations,
    categories,
    topics,
    score: Number(item.score || 0),
    reliability: sourceReliability(item),
  };
}

export function sourceReliability(item) {
  const domain = String(item.metadata?.domain || item.sourceId || "").toLowerCase();
  if (item.metadata?.official || /eett|raaey|admie|deddie|desfa|gov|mindigital|ypen|dei\.gr/.test(domain)) return 0.95;
  if (item.metadata?.adapter === "wordpress") return 0.72;
  if (item.metadata?.adapter === "gdelt") return 0.60;
  return 0.55;
}

function unique(values) { return [...new Set(values.filter(Boolean).map(String))]; }
