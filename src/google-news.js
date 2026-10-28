import { absoluteUrl } from "./sources/utils.js";
import { areNearDuplicates } from "./article-quality.js";
import { unwrapGoogleNewsUrl } from "./public-links.js";

const GOOGLE_NEWS_HOST = "news.google.com";

export function isGoogleNewsUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, "") === GOOGLE_NEWS_HOST; } catch { return false; }
}

async function requestManual(method, url, { fetch, timeoutMs = 8000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method, redirect: "manual", signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Follows HTTP redirects (HEAD, falling back to GET) to resolve a Google
 * News link to its publisher URL, per sources-spec.md §5 canonical_url
 * (max 3 hops). Returns the final URL reached, or null if resolution
 * failed or exceeded the hop limit. In practice news.google.com/rss/
 * articles/... responds 200 with no redirect, so callers should expect
 * this to usually return the same news.google.com URL unresolved.
 */
export async function resolveGoogleNewsLink(url, { fetch, maxHops = 3, timeoutMs = 8000 } = {}) {
  let current = url;
  for (let hop = 0; hop < maxHops; hop += 1) {
    let response = await requestManual("HEAD", current, { fetch, timeoutMs });
    if (!response || response.status === 405) response = await requestManual("GET", current, { fetch, timeoutMs });
    if (!response) return null;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers?.get?.("location");
      if (!location) return null;
      current = absoluteUrl(location, current) || location;
      continue;
    }
    return current;
  }
  return null;
}

// §2 "Google News handling" bounds how many Google links are resolved (each
// hop is a real network round-trip) in a single scan; the rest are flagged
// sectionOnly rather than resolved.
const MAX_GOOGLE_RESOLUTIONS_PER_SCAN = 20;

/**
 * Applies sources-spec.md §2 "Google News handling" to the final, already
 * capped/ranked item list:
 *  1. a Google News item that near-duplicates a direct-source item in the
 *     same scan is dropped; its publisher is attached to the direct item's
 *     metadata.relatedPublishers.
 *  2. otherwise, try to resolve the Google link to the publisher URL (at
 *     most MAX_GOOGLE_RESOLUTIONS_PER_SCAN per call); if resolution fails,
 *     is skipped (no fetch available, or the bound is exceeded), or still
 *     points at news.google.com, keep the item but flag metadata.sectionOnly
 *     so it is excluded from the homepage (buildHomepageSections) while
 *     section pages still list it.
 */
export async function resolveGoogleNewsItems(items, { fetch } = {}) {
  const direct = items.filter((item) => !isGoogleNewsUrl(item.url));
  const dropped = new Set();
  let resolutions = 0;
  for (const item of items) {
    if (!isGoogleNewsUrl(item.url)) continue;
    const match = direct.find((candidate) => areNearDuplicates(candidate, item, { titleThreshold: 0.78, days: 5 }));
    if (match) {
      const publisher = item.metadata?.publisher;
      match.metadata = {
        ...(match.metadata || {}),
        relatedPublishers: [...new Set([...(match.metadata?.relatedPublishers || []), publisher].filter(Boolean))],
      };
      dropped.add(item.url);
      continue;
    }
    // Offline unwrap first: a url=/q= parameter or a legacy plain-text token needs no round-trip.
    const unwrapped = unwrapGoogleNewsUrl(item.url, item.metadata);
    if (unwrapped) {
      item.url = unwrapped;
      continue;
    }
    if (!fetch || resolutions >= MAX_GOOGLE_RESOLUTIONS_PER_SCAN) {
      item.metadata = { ...(item.metadata || {}), sectionOnly: true };
      continue;
    }
    resolutions += 1;
    const resolved = await resolveGoogleNewsLink(item.url, { fetch });
    if (!resolved || isGoogleNewsUrl(resolved)) {
      item.metadata = { ...(item.metadata || {}), sectionOnly: true };
    } else {
      item.url = resolved;
    }
  }
  return items.filter((item) => !dropped.has(item.url));
}
