/** Shared article-quality helpers used before storage and at presentation time. */

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "news", "about", "new",
  "στη", "στην", "στο", "και", "για", "των", "της", "του", "με", "απο", "από", "νέα", "νεο",
]);

export function collapseDuplicateArticles(items = [], { titleThreshold = 0.78, days = 7 } = {}) {
  const kept = [];
  const ordered = [...items].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || dateValue(b) - dateValue(a));
  for (const item of ordered) {
    const duplicate = kept.find((candidate) => areNearDuplicates(candidate, item, { titleThreshold, days }));
    if (duplicate) {
      duplicate.metadata = {
        ...(duplicate.metadata || {}),
        duplicateSources: [...new Set([...(duplicate.metadata?.duplicateSources || []), item.sourceId || item.source_id].filter(Boolean))],
      };
      continue;
    }
    kept.push(item);
  }
  return kept.sort((a, b) => dateValue(b) - dateValue(a));
}

export function areNearDuplicates(a, b, { titleThreshold = 0.78, days = 7 } = {}) {
  const left = tokenSet(a?.title);
  const right = tokenSet(b?.title);
  if (!left.size || !right.size) return false;
  const overlap = jaccard(left, right);
  if (overlap < titleThreshold) return false;
  const leftDate = dateValue(a);
  const rightDate = dateValue(b);
  return !leftDate || !rightDate || Math.abs(leftDate - rightDate) <= days * 86_400_000;
}

function tokenSet(value) {
  return new Set(normalise(value).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return union.size ? intersection / union.size : 0;
}

function normalise(value = "") {
  return String(value).toLocaleLowerCase("el").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function dateValue(item) {
  const value = item?.publishedAt || item?.published_at;
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}
