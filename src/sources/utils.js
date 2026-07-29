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
