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

/**
 * Google News descriptions are "<title>  <publisher>" (the publisher after non-breaking spaces,
 * stored with the entities un-decoded). Returns the clean summary and, when the trailing segment
 * is confirmed by the title's own " - Publisher" tail, that publisher so the title suffix can be
 * stripped. A summary that only repeats the title is dropped (null).
 */
export function readFeedSummary(title, summary) {
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
