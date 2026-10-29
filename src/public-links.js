// Display-time link/title/source cleanup for the public pages. Nothing here writes back to the
// database: stored rows keep whatever ingest saved, and these helpers run when a row is turned
// into the public article shape (public-data.js toArticle/toStory).

// Tracking parameters removed from outgoing links. Prefixes cover utm_*, mc_cid/mc_eid,
// Matomo/Piwik (pk_), HubSpot (hsa_, _hs), Marketo (mkt_), Vero (vero_), Adobe/Omniture ns_*.
const TRACKING_PREFIXES = ["utm_", "mc_", "pk_", "hsa_", "_hs", "mkt_", "vero_", "ns_", "oly_", "ga_"];
const TRACKING_EXACT = new Set([
  "fbclid", "gclid", "dclid", "gbraid", "wbraid", "msclkid", "yclid", "twclid", "ttclid", "li_fat_id",
  "igshid", "igsh", "_ga", "_gl", "ref", "ref_src", "ref_url", "cmpid", "ocid", "ito", "xtor", "trk",
  "trkcampaign", "sr_share", "amp", "spm", "wt_mc", "s_cid", "mbid", "at_medium", "at_campaign",
]);

export function stripTrackingParams(value) {
  let url;
  try { url = new URL(value); } catch { return value; }
  if (!/^https?:$/.test(url.protocol)) return value;
  let changed = false;
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    const outputTypeAmp = lower === "outputtype" && url.searchParams.get(key).toLowerCase() === "amp";
    if (TRACKING_EXACT.has(lower) || TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix)) || outputTypeAmp) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  return changed ? url.href : value;
}

function isGoogleNewsUrl(value) {
  try { return new URL(value).hostname.replace(/^www\./, "") === "news.google.com"; } catch { return false; }
}

function isHttpUrl(value) {
  try { return /^https?:$/.test(new URL(value).protocol); } catch { return false; }
}

function isGoogleHost(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return host === "news.google.com" || host === "google.com" || host.endsWith(".google.com");
  } catch { return false; }
}

// Legacy Google News article tokens (the pre-2024 "CBM…" form) are base64url protobuf with the
// publisher URL in plain text. Newer tokens ("CBMi…AU_yqL…") are encrypted and cannot be decoded
// offline — those stay unresolved.
function urlFromGoogleToken(token) {
  try {
    const bytes = Buffer.from(token.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const text = bytes.toString("latin1");
    const match = text.match(/https?:\/\/[\x21-\x7e]+/);
    if (!match) return null;
    const candidate = match[0].replace(/[^\x21-\x7e]+$/, "");
    return isHttpUrl(candidate) && !isGoogleHost(candidate) ? candidate : null;
  } catch { return null; }
}

/**
 * Returns the publisher URL behind a Google News / google.com redirect link when it can be
 * found WITHOUT a network call: an explicit original URL in the item's metadata, a `url=`/`q=`
 * parameter, or a legacy plain-text token. Returns null when the link cannot be unwrapped.
 */
export function unwrapGoogleNewsUrl(value, metadata = {}) {
  for (const key of ["originalUrl", "publisherUrl", "resolvedUrl", "sourceUrl"]) {
    const candidate = metadata?.[key];
    if (typeof candidate === "string" && isHttpUrl(candidate) && !isGoogleHost(candidate)) return candidate;
  }
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!isGoogleHost(value)) return null;
  for (const param of ["url", "q"]) {
    const candidate = url.searchParams.get(param);
    if (candidate && isHttpUrl(candidate) && !isGoogleHost(candidate)) return candidate;
  }
  const token = url.pathname.match(/\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]+)/)?.[1];
  return token ? urlFromGoogleToken(token) : null;
}

/**
 * The link shown on public pages. `viaGoogleNews` is true when the link still points at
 * news.google.com because the original URL is not in the data, so the page can say so.
 */
export function cleanOutgoingLink(value, metadata = {}) {
  if (!value) return { url: value, viaGoogleNews: false, unwrapped: false };
  const unwrapped = isGoogleHost(value) ? unwrapGoogleNewsUrl(value, metadata) : null;
  const url = stripTrackingParams(unwrapped || value);
  return { url, viaGoogleNews: isGoogleNewsUrl(url), unwrapped: Boolean(unwrapped) };
}

const SOURCE_NAME_NOISE = /\s*\((?:μηνιαία σελίδα|monthly page)\)\s*$/i;

/**
 * Public name of the publisher: the Google News <source> publisher when there is one, else the
 * source's configured name, else the link's host. Never the internal source id.
 */
export function publicSourceName({ publisher, configuredName, url } = {}) {
  if (publisher) return String(publisher).trim();
  if (configuredName) return String(configuredName).replace(SOURCE_NAME_NOISE, "").trim();
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "news.google.com" ? null : host;
  } catch { return null; }
}

function plainText(value) {
  let text = String(value ?? "");
  for (let i = 0; i < 2; i += 1) {
    text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
  }
  return text.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;|\u00a0/g, " ");
}

const compare = (value) => plainText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// round-7 summary cleanup (display time only; stored summaries are untouched).

// Feed "read more" markers that survive as literal text: "[&hellip;]", "[…]", "[...]", "[ … ]".
const READ_MORE_MARKER = /\s*\[\s*(?:&amp;hellip;|&hellip;|&#0*8230;|&#x0*2026;|…|\.{3})\s*\]/gi;

// energypress leftovers at the end of a summary: the author handle and the post date/time,
// e.g. "… μιλώντας στο... ekalogerh 28 10 2026 | 07:30".
const TRAILING_BYLINE = /(?:\s+[\p{L}][\p{L}\p{N}_.]*)?\s+\d{1,2}[ ./-]\d{1,2}[ ./-]\d{4}\s*\|\s*\d{1,2}:\d{2}\s*$/u;

const alnum = (value) => /[\p{L}\p{N}]/u.test(value);

/** `text` without a leading copy of `title` (punctuation/spacing/case-insensitive), or null if it does not start with it. */
function stripLeadingTitle(text, title) {
  const wanted = [...compare(title).replace(/\s+/g, "")];
  if (wanted.length < 8) return null;
  const chars = [...text];
  let matched = 0;
  let index = 0;
  while (index < chars.length && matched < wanted.length) {
    const char = chars[index];
    if (!alnum(char)) { index += 1; continue; }
    if (char.toLowerCase() !== wanted[matched]) return null;
    matched += 1;
    index += 1;
  }
  if (matched < wanted.length) return null;
  return chars.slice(index).join("").replace(/^[\s\-–—:|.,·]+/u, "").trim();
}

/** `text` without a trailing copy of `title`, or null. */
function stripTrailingTitle(text, title) {
  const wanted = [...compare(title).replace(/\s+/g, "")];
  if (wanted.length < 8) return null;
  const chars = [...text];
  let matched = 0;
  let index = chars.length - 1;
  while (index >= 0 && matched < wanted.length) {
    const char = chars[index];
    if (!alnum(char)) { index -= 1; continue; }
    if (char.toLowerCase() !== wanted[wanted.length - 1 - matched]) return null;
    matched += 1;
    index -= 1;
  }
  if (matched < wanted.length) return null;
  return chars.slice(0, index + 1).join("").replace(/[\s\-–—:|·]+$/u, "").trim();
}

// A trailing " - <Publisher>" / " | <Publisher>": the segment is a publisher the row already names
// (source name, host, feed publisher, the title's own tail) or a short all-capitals sitename such as
// "Η ΝΑΥΤΕΜΠΟΡΙΚΗ". The dash must be spaced, so "FTTH-ΟΤΕ" style compounds are never split.
const TRAILING_PUBLISHER = /\s+[-–—|]\s+([^-–—|]{2,40})$/u;

function isSitenameSegment(segment, publishers) {
  const key = compare(segment);
  if (!key) return false;
  if (publishers.some((name) => name && compare(name) === key)) return true;
  const trimmed = segment.trim();
  if (/[.!?;:,]$/.test(trimmed) || /\d/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;
  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  const name = trimmed.replace(/^(?:Η|Ο|Το|Οι|Τα|The)\s+/u, "");
  const nameLetters = name.replace(/[^\p{L}]/gu, "");
  return nameLetters.length >= 6 && letters === letters.toLocaleUpperCase("el") && letters !== letters.toLocaleLowerCase("el");
}

function stripTrailingPublisher(text, publishers) {
  const match = text.match(TRAILING_PUBLISHER);
  if (!match || !isSitenameSegment(match[1], publishers)) return text;
  return text.slice(0, match.index).trim();
}

/**
 * Summary text as shown to readers: no "[…]" markers, no " - <Publisher>" tail, no energypress
 * "handle date | time" leftovers, and no copy of the headline at the start (or end) of the summary.
 * Returns null when nothing is left.
 */
export function cleanSummaryText(summary, { title = "", publishers = [] } = {}) {
  if (summary == null) return summary ?? null;
  let text = String(summary).replace(READ_MORE_MARKER, "").replace(/&hellip;|&#0*8230;/gi, "…").replace(/\s+/g, " ").trim();
  const titleText = plainText(title).replace(/\s+/g, " ").trim();
  const tail = titleText.match(/^(.*\S)\s+[-–—|]\s+([^-–—|]+)$/);
  const bareTitle = tail ? tail[1] : titleText;
  const sitenames = [...publishers, tail?.[2]];
  for (let pass = 0; pass < 2; pass += 1) {
    text = text.replace(TRAILING_BYLINE, "").trim();
    text = stripTrailingPublisher(text, sitenames);
  }
  if (bareTitle) {
    for (const candidate of [titleText, bareTitle]) {
      const withoutLead = stripLeadingTitle(text, candidate);
      if (withoutLead !== null) { text = withoutLead; break; }
    }
    for (const candidate of [titleText, bareTitle]) {
      const withoutTail = stripTrailingTitle(text, candidate);
      if (withoutTail !== null) { text = withoutTail; break; }
    }
  }
  text = text.replace(TRAILING_BYLINE, "").trim();
  return text || null;
}

/**
 * Google News descriptions are "<title>  <publisher>" (the publisher after non-breaking spaces,
 * stored with the entities un-decoded). Returns the clean summary and, when the trailing segment
 * is confirmed by the title's own " - Publisher" tail, that publisher so the title suffix can be
 * stripped. A summary that only repeats the title is dropped (null).
 */
export function readFeedSummary(title, summary, { publishers = [] } = {}) {
  const feed = splitFeedSummary(title, summary);
  return { ...feed, summary: cleanSummaryText(feed.summary, { title, publishers: [...publishers, feed.publisher] }) };
}

function splitFeedSummary(title, summary) {
  if (!summary) return { summary: summary ?? null, publisher: null };
  const text = plainText(summary).trim();
  const parts = text.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
  const titleText = plainText(title);
  const tailMatch = titleText.match(/^(.*\S)\s+[-–—|]\s+([^-–—|]+)$/);
  if (parts.length >= 2 && tailMatch) {
    const publisher = parts[parts.length - 1];
    if (compare(publisher) === compare(tailMatch[2])) {
      const body = parts.slice(0, -1).join(" ");
      const bodyKey = compare(body);
      const repeatsTitle = bodyKey === compare(tailMatch[1]) || bodyKey === compare(titleText);
      return { summary: repeatsTitle ? null : body, publisher: tailMatch[2].trim() };
    }
  }
  return { summary: text.replace(/\s+/g, " "), publisher: null };
}
