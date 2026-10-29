import { createHash, timingSafeEqual } from "node:crypto";
import { CATEGORY_TO_SPEC_SECTION, noiseRejectReason } from "./feed-rules.js";
import { stripTrackingParams } from "./public-links.js";
import { canonicalizeUrl, cleanUrl } from "./sources/utils.js";
import { detectArticleOrganizations } from "./article-organizations.js";

/**
 * Curated items: stories an editor picked by hand and uploads through POST /api/curated
 * (src/app/api/curated/route.js). They live in the same `articles` table as scanned items and
 * carry articles.source_kind = 'curated' (plus metadata.sourceKind / metadata.tier = 1) so they
 * are identifiable and removable:  DELETE FROM articles WHERE source_kind = 'curated';
 */
export const CURATED_SOURCE_KIND = "curated";
export const CURATED_MAX_ITEMS = 50;
export const CURATED_MAX_BODY_BYTES = 256 * 1024;
// A neutral stored score. Curated rows never depend on it: the read-time rules keep it and the
// homepage score floors do not apply to them (see public-data.js).
export const CURATED_SCORE = 12;

export const CURATED_LIMITS = Object.freeze({
  title: { min: 10, max: 220 },
  summary: { min: 20, max: 600 },
  url: { max: 500 },
  source: { min: 2, max: 60 },
});

const ALLOWED_FIELDS = new Set(["title_el", "summary_el", "url", "source", "published_at", "section"]);
// Spec section id (the API's `section`) -> public category slug stored in articles.categories.
const SLUG_BY_SECTION = Object.freeze(
  Object.fromEntries(Object.entries(CATEGORY_TO_SPEC_SECTION).map(([slug, section]) => [section, slug])),
);
export const CURATED_SECTIONS = Object.freeze(Object.keys(SLUG_BY_SECTION));

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const GREEK = /\p{Script=Greek}/u;
const SOURCE_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._&'-]*$/u;
const MAX_FUTURE_MS = 10 * 60_000;
const MAX_AGE_MS = 365 * 86_400_000;

export function isCuratedRow(row) {
  return row?.source_kind === CURATED_SOURCE_KIND || row?.metadata?.sourceKind === CURATED_SOURCE_KIND;
}

/** Constant-time check of an `Authorization: Bearer <secret>` header. False when no secret is configured. */
export function isCuratedAuthorised(authorization, secret) {
  if (typeof secret !== "string" || !secret) return false;
  if (typeof authorization !== "string") return false;
  const match = /^Bearer (.+)$/.exec(authorization);
  if (!match) return false;
  // Hash both sides so the comparison is over equal-length buffers whatever the input length.
  const given = createHash("sha256").update(match[1]).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(given, expected);
}

/** Why a URL cannot be accepted, or null. Rejects, never silently cleans. */
export function curatedUrlProblem(value) {
  if (typeof value !== "string" || !value.trim()) return "url_missing";
  if (value !== value.trim()) return "url_whitespace";
  if (value.length > CURATED_LIMITS.url.max) return "url_too_long";
  let url;
  try { url = new URL(value); } catch { return "url_invalid"; }
  if (url.protocol !== "https:") return "url_not_https";
  if (url.username || url.password) return "url_credentials";
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[") || host === "localhost") return "url_bad_host";
  if (host === "news.google.com" || host.endsWith(".news.google.com")) return "url_google_news";
  if (/(^|\.)google\.[a-z.]+$/.test(host) && /^\/(url|amp|news)(\/|$)/.test(url.pathname)) return "url_google_redirect";
  // utm_* and the other click/tracking parameters the public site strips (public-links.js).
  if (stripTrackingParams(url.href) !== url.href) return "url_tracking_params";
  return null;
}

/**
 * Validates an uploaded body that has already been JSON-parsed.
 * Returns { error } for a body that is not usable as a whole, else { items, rejected, duplicates }:
 * `items` are accepted, normalised and de-duplicated by canonical URL inside the batch.
 */
export function validateCuratedBatch(body, { now = Date.now() } = {}) {
  if (!Array.isArray(body)) return { error: "Body must be a JSON array" };
  if (!body.length) return { error: "Body must contain at least one item" };
  if (body.length > CURATED_MAX_ITEMS) return { error: `At most ${CURATED_MAX_ITEMS} items per request` };

  const items = [];
  const rejected = [];
  let duplicates = 0;
  const seen = new Set();
  for (const [index, raw] of body.entries()) {
    const url = typeof raw?.url === "string" ? raw.url : `#${index}`;
    const result = validateCuratedItem(raw, { now });
    if (result.reason) { rejected.push({ url, reason: result.reason }); continue; }
    const identity = canonicalizeUrl(result.item.url);
    if (seen.has(identity)) { duplicates += 1; continue; }
    seen.add(identity);
    items.push(result.item);
  }
  return { items, rejected, duplicates };
}

export function validateCuratedItem(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { reason: "not_an_object" };
  const unknown = Object.keys(raw).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unknown.length) return { reason: `unknown_field:${unknown.slice(0, 3).join(",")}` };

  const urlProblem = curatedUrlProblem(raw.url);
  if (urlProblem) return { reason: urlProblem };

  const title = textField(raw.title_el, CURATED_LIMITS.title);
  if (title.reason) return { reason: `title_${title.reason}` };
  if (!GREEK.test(title.value)) return { reason: "title_not_greek" };
  const summary = textField(raw.summary_el, CURATED_LIMITS.summary);
  if (summary.reason) return { reason: `summary_${summary.reason}` };
  if (!GREEK.test(summary.value)) return { reason: "summary_not_greek" };

  if (typeof raw.source !== "string") return { reason: "source_missing" };
  const source = raw.source.trim();
  if (source.length < CURATED_LIMITS.source.min) return { reason: "source_too_short" };
  if (source.length > CURATED_LIMITS.source.max) return { reason: "source_too_long" };
  if (!SOURCE_NAME.test(source)) return { reason: "source_invalid" };

  if (typeof raw.published_at !== "string" || !ISO_WITH_OFFSET.test(raw.published_at)) return { reason: "published_at_not_iso_with_offset" };
  const published = Date.parse(raw.published_at);
  if (Number.isNaN(published)) return { reason: "published_at_invalid" };
  if (published > now + MAX_FUTURE_MS) return { reason: "published_at_in_future" };
  if (published < now - MAX_AGE_MS) return { reason: "published_at_too_old" };

  const category = SLUG_BY_SECTION[raw.section];
  if (typeof raw.section !== "string" || !category) return { reason: "unknown_section" };

  const item = {
    url: cleanUrl(raw.url),
    title: title.value,
    summary: summary.value,
    publishedAt: new Date(published).toISOString(),
    source,
    sourceId: `${CURATED_SOURCE_KIND}:${source.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}`,
    section: raw.section,
    category,
  };
  // Same hard rejections the scanner and the read-time rules apply: stock-market pieces, sponsored
  // and promo content, culture/CSR items, and the rest of noiseRejectReason.
  const noise = noiseRejectReason({ title: item.title, summary: item.summary, url: item.url, sourceId: item.sourceId });
  if (noise) return { reason: `noise:${noise.group}` };
  return { item };
}

function textField(value, { min, max }) {
  if (typeof value !== "string") return { reason: "missing" };
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < min) return { reason: "too_short" };
  if (text.length > max) return { reason: "too_long" };
  if (/[<>]/.test(text)) return { reason: "markup" };
  return { value: text };
}

/**
 * Writes validated items the way ingest-service.js writes scanned ones (same columns, same
 * article_organizations links) plus source_kind = 'curated'. An existing canonical_url is left
 * untouched (ON CONFLICT DO NOTHING), so re-sending a file is a no-op. Returns { inserted, duplicates }.
 */
export async function storeCuratedItems(sql, items) {
  let inserted = 0;
  let duplicates = 0;
  for (const item of items) {
    const relevance = [{
      ruleId: "curated", label: "Curated", category: item.category, score: CURATED_SCORE, accepted: true,
      reasons: ["editor-curated item"],
    }];
    const metadata = {
      sourceKind: CURATED_SOURCE_KIND,
      tier: 1,
      curated: true,
      publisher: item.source,
      section: item.section,
      lang: "el",
    };
    const rows = await sql`
      INSERT INTO articles
        (canonical_url, title, summary, published_at, source_id, source_url,
         score, categories, relevance, metadata, source_kind)
      VALUES
        (${item.url}, ${item.title}, ${item.summary}, ${item.publishedAt},
         ${item.sourceId}, ${item.url}, ${CURATED_SCORE},
         ${[item.category]}, ${JSON.stringify(relevance)}::jsonb,
         ${JSON.stringify(metadata)}::jsonb, ${CURATED_SOURCE_KIND})
      ON CONFLICT (canonical_url) DO NOTHING
      RETURNING id
    `;
    if (!rows.length) { duplicates += 1; continue; }
    inserted += 1;
    for (const match of detectArticleOrganizations({ title: item.title, summary: item.summary })) {
      await sql`
        INSERT INTO article_organizations
          (article_id, organization_id, match_kind, confidence)
        VALUES (${rows[0].id}, ${match.organizationId}, ${match.matchKind}, ${match.confidence})
        ON CONFLICT (article_id, organization_id) DO NOTHING
      `;
    }
  }
  return { inserted, duplicates };
}
