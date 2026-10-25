import { absoluteUrl, fetchText, stripTags } from "./utils.js";
import { athensDateToIso } from "./html-scrape.js";

/**
 * sources-spec.md round-4 §2.1 ggtt-telecom-announcements: the listing page
 * mixes article links (/posts/<slug>) with /section/ navigation links and a
 * bare /posts index, so links are restricted to the former. Each listing
 * title starts with a Greek date ("20 Οκτωβρίου 2026") and sometimes an
 * "Η προθεσμία έληξε" prefix; both are parsed out instead of left in the
 * displayed title.
 */
const GGTT_LINK_PATTERN = /^\/posts\/[a-z0-9-]+\/?$/i;
const GREEK_MONTHS = {
  "Ιανουαρίου": 1, "Φεβρουαρίου": 2, "Μαρτίου": 3, "Απριλίου": 4, "Μαΐου": 5, "Ιουνίου": 6,
  "Ιουλίου": 7, "Αυγούστου": 8, "Σεπτεμβρίου": 9, "Οκτωβρίου": 10, "Νοεμβρίου": 11, "Δεκεμβρίου": 12,
};
const GGTT_DATE_RE = new RegExp(`(\\d{1,2})\\s+(${Object.keys(GREEK_MONTHS).join("|")})\\s+(20\\d\\d)`);
const GGTT_DEADLINE_PREFIX_RE = /^Η\s+προθεσμία\s+έληξε\s*[:\-–]?\s*/iu;

export class GgttSourceAdapter {
  constructor(options = {}) { this.fetch = options.fetch || globalThis.fetch; }

  async load(source) {
    const result = await fetchText(this.fetch, source.url, {
      headers: source.headers,
      timeoutMs: source.timeoutMs,
      maxBytes: source.maxBytes,
      accept: "text/html, application/xhtml+xml",
    });
    return parseGgttListing(result.text, result.url).slice(0, source.limit || 100);
  }
}

/** Pure parse: GGTT listing HTML -> items with link-filtered /posts/<slug> URLs and a parsed publishedAt. */
export function parseGgttListing(html, sourceUrl) {
  const anchors = [...html.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
  const items = anchors.flatMap(([, , href, , contents]) => {
    const url = absoluteUrl(href, sourceUrl);
    if (!url) return [];
    let pathname;
    try { pathname = new URL(url).pathname; } catch { return []; }
    if (!GGTT_LINK_PATTERN.test(pathname)) return [];

    let title = stripTags(contents);
    const dateMatch = title.match(GGTT_DATE_RE);
    const publishedAt = dateMatch
      ? athensDateToIso(dateMatch[1], String(GREEK_MONTHS[dateMatch[2]]).padStart(2, "0"), dateMatch[3])
      : undefined;
    // Trim before the deadline-prefix check: it's anchored to the start of
    // the string, and removing the leading date leaves a stray space.
    if (dateMatch) title = title.replace(dateMatch[0], " ").trim();
    title = title.replace(GGTT_DEADLINE_PREFIX_RE, "").replace(/\s+/g, " ").trim();
    if (!title) return [];

    return [{ id: url, url, title, summary: undefined, publishedAt, sourceUrl, metadata: {} }];
  });
  const unique = new Map();
  for (const item of items) {
    const previous = unique.get(item.url);
    if (!previous || item.title.length > previous.title.length) unique.set(item.url, item);
  }
  return [...unique.values()];
}
