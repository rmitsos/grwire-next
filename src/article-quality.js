/** Shared article-quality helpers used before storage and at presentation time. */

import { canonicalizeUrl, decodeEntities } from "./sources/utils.js";

const RAW_STOP_WORDS = [
  "the", "and", "for", "with", "from", "that", "this", "news", "about", "new",
  "στη", "στην", "στο", "στον", "και", "για", "των", "της", "του", "με", "από",
  "το", "τον", "την", "τα", "οι", "ο", "η", "σε", "να", "που", "ως",
  "νέος", "νέα", "νέο", "νέων", "νέες", "νέοι", "νέου", "νέας",
];
const STOP_WORDS = new Set(RAW_STOP_WORDS.map((word) => normalise(word)));

// Greek/English endings stripped (longest first) so inflected forms of the
// same word collapse to a shared stem. This is a light heuristic, not a real
// morphological analyzer: it only needs to unify the handful of noun/verb
// inflections that show up across syndicated Greek headlines.
const STEM_SUFFIXES = [
  "ηθηκαν", "ηθηκε", "ονται", "εται", "ουμε", "ετε", "οντας",
  "ουσα", "ουσε", "εισ", "ουν", "αμε", "ατε", "νει", "σε",
  "ων", "ωνσ", "εσ", "ασ", "ησ", "οσ", "ου", "οι", "αι",
  "α", "ε", "η", "ι", "ο", "υ", "σ",
];

// Finds the last " - "/" | "/dash-variant separator in a title and returns
// the text on each side, or null if there is no such separator.
function splitTrailingSegment(title = "") {
  const text = String(title ?? "");
  const separators = [" - ", " – ", " — ", " | "];
  let bestIndex = -1;
  let bestLength = 0;
  for (const separator of separators) {
    const index = text.lastIndexOf(separator);
    if (index > bestIndex) {
      bestIndex = index;
      bestLength = separator.length;
    }
  }
  if (bestIndex === -1) return null;
  return { head: text.slice(0, bestIndex).trim(), tail: text.slice(bestIndex + bestLength).trim() };
}

export function stripTrailingSiteSuffix(title = "") {
  const split = splitTrailingSegment(title);
  if (!split || !looksLikeSiteSuffix(split.tail)) return String(title ?? "");
  return split.head;
}

function looksLikeSiteSuffix(segment) {
  if (!segment) return false;
  // A trailing publisher credit almost always resolves to a domain, e.g.
  // "Ypodomes.com" or "marketingweek.gr". Real title clauses ("Στα 196
  // εκατ. ευρώ το κόστος") never end in a dot-domain, so this stays safe.
  return /\.[a-z]{2,6}\s*$/i.test(segment);
}

// sources-spec.md §5 title_clean: strip the trailing " - Publisher" / " | Publisher"
// segment only when it matches one of the item's own source candidates
// (source name, host label, or a Google News <source> publisher) — unlike
// stripTrailingSiteSuffix above, this never guesses from a domain-looking
// suffix alone, so real title clauses are never cut by mistake.
export function cleanTitleForSource(title = "", candidates = []) {
  const decoded = decodeEntities(String(title ?? ""));
  const split = splitTrailingSegment(decoded);
  if (!split) return decoded;
  const normalizedTail = normalise(split.tail);
  if (!normalizedTail) return decoded;
  const matchesSource = candidates.filter(Boolean).some((candidate) => {
    const normalizedCandidate = normalise(candidate);
    return normalizedCandidate
      && (normalizedTail === normalizedCandidate
        || normalizedTail.includes(normalizedCandidate)
        || normalizedCandidate.includes(normalizedTail));
  });
  return matchesSource ? split.head : decoded;
}

function stemToken(token, minStemLength = 4) {
  for (const suffix of STEM_SUFFIXES) {
    if (token.length - suffix.length < minStemLength) continue;
    if (token.endsWith(suffix)) return token.slice(0, token.length - suffix.length);
  }
  return token;
}

export function normalizeTitle(title = "", { minStemLength = 4 } = {}) {
  const stripped = stripTrailingSiteSuffix(String(title ?? ""));
  const normalised = normalise(stripped)
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[:;,.!?()«»]/g, " ");
  const tokens = normalised
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .map((token) => stemToken(token, minStemLength));
  return tokens.join(" ");
}

export function collapseDuplicateArticles(items = [], { titleThreshold = 0.9, days = 7, crossLanguage = false } = {}) {
  const kept = [];
  const ordered = [...items].sort((a, b) =>
    Number(b.score || 0) - Number(a.score || 0)
    || dateValue(b) - dateValue(a)
    || isGoogleNews(a) - isGoogleNews(b));
  for (const item of ordered) {
    const duplicate = kept.find((candidate) => areNearDuplicates(candidate, item, { titleThreshold, days, crossLanguage }));
    if (duplicate) {
      duplicate.metadata = {
        ...(duplicate.metadata || {}),
        duplicateSources: [...new Set([...(duplicate.metadata?.duplicateSources || []), item.sourceId || item.source_id].filter(Boolean))],
        // sources-spec.md §2 "Google News handling" (1): a dropped Google
        // News duplicate's publisher is attached to the surviving item.
        ...(isGoogleNews(item) && item.metadata?.publisher
          ? { relatedPublishers: [...new Set([...(duplicate.metadata?.relatedPublishers || []), item.metadata.publisher])] }
          : {}),
      };
      continue;
    }
    kept.push(item);
  }
  return kept.sort((a, b) => dateValue(b) - dateValue(a));
}

export function areNearDuplicates(a, b, { titleThreshold = 0.9, days = 7, crossLanguage = false } = {}) {
  const sameCanonicalUrl = sameUrl(a?.url || a?.canonical_url, b?.url || b?.canonical_url);
  if (sameCanonicalUrl) return true;

  const left = tokenSet(a?.title);
  const right = tokenSet(b?.title);
  if (!left.size || !right.size) return false;
  const similarity = Math.max(jaccard(left, right), overlapCoefficient(left, right));
  const leftDate = dateValue(a);
  const rightDate = dateValue(b);
  const closeInTime = !leftDate || !rightDate || Math.abs(leftDate - rightDate) <= days * 86_400_000;
  if (!closeInTime) return false;
  if (similarity >= titleThreshold) return true;
  return crossLanguage && hasSharedStoryMarkers(a, b);
}

function sameUrl(a, b) {
  if (!a || !b) return false;
  const left = canonicalizeUrl(a);
  const right = canonicalizeUrl(b);
  return Boolean(left) && left === right;
}

function isGoogleNews(item) {
  try {
    return new URL(item?.url || item?.canonical_url).hostname.replace(/^www\./, "") === "news.google.com" ? 1 : 0;
  } catch {
    return 0;
  }
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
  return new Set(normalizeTitle(value).split(" ").filter(Boolean));
}

function jaccard(left, right) {
  const union = new Set([...left, ...right]);
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return union.size ? intersection / union.size : 0;
}

function overlapCoefficient(left, right) {
  const smaller = Math.min(left.size, right.size);
  if (!smaller) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / smaller;
}

function normalise(value = "") {
  return String(value).toLocaleLowerCase("el").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ς/g, "σ");
}

function dateValue(item) {
  const value = item?.publishedAt || item?.published_at;
  const parsed = Date.parse(value || "");
  return Number.isNaN(parsed) ? 0 : parsed;
}
