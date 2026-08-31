/** Shared article-quality helpers used before storage and at presentation time. */

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "news", "about", "new",
  "στη", "στην", "στο", "και", "για", "των", "της", "του", "με", "απο", "από", "νέα", "νεο",
]);

export function collapseDuplicateArticles(items = [], { titleThreshold = 0.78, days = 7, crossLanguage = false } = {}) {
  const kept = [];
  const ordered = [...items].sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || dateValue(b) - dateValue(a));
  for (const item of ordered) {
    const duplicate = kept.find((candidate) => areNearDuplicates(candidate, item, { titleThreshold, days, crossLanguage }));
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

export function areNearDuplicates(a, b, { titleThreshold = 0.78, days = 7, crossLanguage = false } = {}) {
  const left = tokenSet(a?.title);
  const right = tokenSet(b?.title);
  if (!left.size || !right.size) return false;
  const overlap = jaccard(left, right);
  const leftDate = dateValue(a);
  const rightDate = dateValue(b);
  const closeInTime = !leftDate || !rightDate || Math.abs(leftDate - rightDate) <= days * 86_400_000;
  if (!closeInTime) return false;
  if (overlap >= titleThreshold) return true;
  return crossLanguage && hasSharedStoryMarkers(a, b);
}

// Language-neutral markers catch the common case where the same wire story
// is published in Greek and English with completely different headlines.
const STORY_MARKER_GROUPS = [
  ["ote", "οτε"], ["cosmote", "κοσμοτε"], ["vodafone"], ["nova"], ["intracom"],
  ["eett", "εεττ"], ["admie", "ipto", "αδμηε"], ["desfa", "δεσφα"],
  ["ftth", "fiber", "fibre", "οπτικη ιν"], ["5g"], ["spectrum", "φασμα"],
  ["mobile-billing", "mobile billed", "carrier billing", "χρεωσ", "κινητ"],
  ["network", "δικτυ"], ["investment", "επενδ"], ["regulation", "κανον", "ρυθμ"],
  ["roaming", "περιαγωγ"], ["interconnection", "διασυνδεσ"], ["broadband", "ευρυζων"],
];
const STORY_ENTITY_MARKERS = new Set(["ote", "cosmote", "vodafone", "nova", "intracom", "eett", "admie", "desfa"]);

function hasSharedStoryMarkers(a, b) {
  const left = storyMarkers(a);
  const right = storyMarkers(b);
  const shared = [...left].filter((marker) => right.has(marker));
  return shared.some((marker) => STORY_ENTITY_MARKERS.has(marker))
    && shared.some((marker) => !STORY_ENTITY_MARKERS.has(marker));
}

function storyMarkers(item) {
  const text = normalise(`${item?.title || ""} ${item?.summary || ""}`);
  return new Set(STORY_MARKER_GROUPS
    .filter((group) => group.some((term) => text.includes(normalise(term))))
    .map((group) => group[0]));
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
