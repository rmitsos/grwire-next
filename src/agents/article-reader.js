import { fetchText, stripTags, toIsoDate } from "../sources/utils.js";

/**
 * Opens an article URL and extracts first-party metadata and readable text.
 * RSS/API records are treated as leads; this reader is the evidence payload
 * passed to Source Guardian and the downstream intelligence agents.
 */
export async function readArticle(item, { fetch = globalThis.fetch, timeoutMs = 8_000, maxBytes = 1_500_000 } = {}) {
  const result = await fetchText(fetch, item.url, {
    timeoutMs,
    maxBytes,
    accept: "text/html, application/xhtml+xml",
  });
  const parsed = parseArticleHtml(result.text, result.url || item.url);
  return {
    ...item,
    url: parsed.canonicalUrl || item.url,
    title: parsed.title || item.title,
    summary: parsed.summary || item.summary,
    publishedAt: parsed.publishedAt || item.publishedAt,
    metadata: {
      ...(item.metadata || {}),
      articleReader: {
        status: "read",
        contentLength: parsed.body.length,
        contentType: result.contentType || null,
        finalUrl: result.url || item.url,
      },
      articleBody: parsed.body,
    },
  };
}

export async function readArticles(items, { fetch = globalThis.fetch, concurrency = 5, limit = 60 } = {}) {
  const output = [...items];
  for (let index = 0; index < Math.min(output.length, limit); index += concurrency) {
    const batch = output.slice(index, index + concurrency);
    const results = await Promise.all(batch.map(async (item) => {
      try { return await readArticle(item, { fetch }); }
      catch (error) {
        return {
          ...item,
          metadata: {
            ...(item.metadata || {}),
            articleReader: { status: "failed", error: error?.message || String(error) },
          },
        };
      }
    }));
    output.splice(index, results.length, ...results);
  }
  return output;
}

export function parseArticleHtml(html, sourceUrl) {
  const canonical = firstAttr(html, /<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["']/i)
    || firstMeta(html, "og:url");
  const title = firstMeta(html, "og:title") || firstTag(html, "h1") || firstTag(html, "title");
  const summary = firstMeta(html, "description") || firstMeta(html, "og:description");
  const publishedAt = toIsoDate(
    firstMeta(html, "article:published_time") ||
    firstMeta(html, "datePublished") ||
    firstAttr(html, /<time\b[^>]*datetime=["']([^"']+)["']/i),
  );
  const body = extractReadableBody(html);
  let canonicalUrl = sourceUrl;
  try { if (canonical) canonicalUrl = new URL(canonical, sourceUrl).href; } catch { /* keep source URL */ }
  return { canonicalUrl, title: clean(title), summary: clean(summary), publishedAt, body };
}

function extractReadableBody(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html;
  const paragraphs = [...article.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => clean(match[1]))
    .filter((value) => value.length >= 35);
  const text = (paragraphs.length ? paragraphs : [stripTags(article)]).join(" ");
  return text.slice(0, 30_000);
}

function firstMeta(html, key) {
  const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["']`, "i"))
    || html.match(new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"));
  return match?.[1];
}

function firstTag(html, tag) {
  return html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1];
}

function firstAttr(html, pattern) { return html.match(pattern)?.[1]; }
function clean(value) { return stripTags(String(value || "")).replace(/\s+/g, " ").trim(); }
