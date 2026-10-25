// sources-spec.md §5 canonical_url.strip_params: "utm_*", "fbclid", "gclid",
// "mc_cid", "mc_eid", "amp", "outputType=amp" (value-gated, handled below).
// "ref" is kept from the pre-spec behaviour (not in the spec list, but
// relied on by existing stored links/tests).
const TRACKING_PARAM_PREFIXES = ["utm_", "mc_"];
const TRACKING_PARAM_EXACT = new Set(["fbclid", "gclid", "ref", "amp"]);

function stripTrackingParams(url) {
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAM_EXACT.has(lower) || TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
      url.searchParams.delete(key);
      continue;
    }
    if (lower === "outputtype" && url.searchParams.get(key).toLowerCase() === "amp") url.searchParams.delete(key);
  }
}

// Strips a trailing "/amp" or "/amp/" path suffix (sources-spec.md §5
// canonical_url.strip_path_suffix), independent of any other trailing-slash
// normalisation the caller applies.
function stripAmpPathSuffix(pathname) {
  return pathname.replace(/\/amp\/?$/i, "") || "/";
}

/**
 * Produces a stable identity URL for dedupe/storage: lowercase host, no
 * `www.`, no tracking params, no fragment, no `/amp` suffix or trailing
 * slash. Returns the input unchanged if it cannot be parsed as a URL.
 */
export function canonicalizeUrl(value) {
  if (value === undefined || value === null) return value;
  try {
    const decoded = String(value).replace(/&amp;/g, "&");
    const url = new URL(decoded);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    stripTrackingParams(url);
    let pathname = stripAmpPathSuffix(url.pathname);
    if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "") || "/";
    url.pathname = pathname || "/";
    return url.href;
  } catch {
    return value;
  }
}

/**
 * Produces the URL stored for display/links: lowercase host, decoded
 * `&amp;`, no tracking params, no fragment. Unlike canonicalizeUrl, this
 * keeps `www.`, the path and any trailing slash as published, so stored
 * links keep working on hosts that require (or omit) the www. prefix.
 * Returns the input unchanged if it cannot be parsed as a URL.
 */
export function cleanUrl(value) {
  if (value === undefined || value === null) return value;
  try {
    const decoded = String(value).replace(/&amp;/g, "&");
    const url = new URL(decoded);
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    stripTrackingParams(url);
    url.pathname = stripAmpPathSuffix(url.pathname);
    return url.href;
  } catch {
    return value;
  }
}

export function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

export function stripTags(value = "") {
  return decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

export function absoluteUrl(value, baseUrl) {
  try { return new URL(decodeEntities(value), baseUrl).href; } catch { return null; }
}

export function firstTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : undefined;
}

export function toIsoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export function normalizeItem(item, sourceUrl) {
  const url = absoluteUrl(item.url, sourceUrl);
  if (!url) throw new TypeError(`Invalid item URL: ${item.url}`);
  return {
    id: item.id || url,
    url,
    title: stripTags(item.title || "") || url,
    summary: stripTags(item.summary || "") || undefined,
    publishedAt: toIsoDate(item.publishedAt),
    sourceUrl,
    metadata: item.metadata || {}
  };
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;

/**
 * Fetches a source without allowing a slow server or an unexpectedly large
 * response to consume an entire serverless invocation.
 */
export async function fetchText(fetchImpl, url, options = {}) {
  const {
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    accept = "*/*",
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: {
        "User-Agent": "GRWire/0.2 (+https://grwire.com)",
        Accept: accept,
        ...headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);

    const declared = Number(response.headers?.get?.("content-length"));
    if (declared && declared > maxBytes) {
      throw new Error(`Response exceeds ${maxBytes} bytes`);
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error(`Response exceeds ${maxBytes} bytes`);
    }
    return { text, url: response.url || url, contentType: response.headers?.get?.("content-type") };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
