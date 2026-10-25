import { absoluteUrl, fetchText, firstTag, normalizeItem } from "./utils.js";

/** Parses RSS 2.0 and Atom feeds into the common source item shape. */
export class RssSourceAdapter {
  constructor(options = {}) { this.fetch = options.fetch || globalThis.fetch; }

  async load(source) {
    const result = await fetchText(this.fetch, source.url, {
      headers: source.headers,
      timeoutMs: source.timeoutMs,
      maxBytes: source.maxBytes,
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
    });
    return this.parse(result.text, result.url, source);
  }

  parse(xml, sourceUrl, source = {}) {
    const excludeTitlePatterns = (source.excludeTitlePatterns || []).map((pattern) => new RegExp(pattern, "iu"));
    const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
    return blocks.flatMap(([, kind, body]) => {
      let link = firstTag(body, "link");
      if (kind.toLowerCase() === "entry") {
        const alternate = body.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
        link = alternate?.[1] || link;
      }
      link = absoluteUrl(link, sourceUrl);
      if (!link) return [];
      const title = firstTag(body, "title");
      if (excludeTitlePatterns.some((pattern) => pattern.test(title || ""))) return [];
      return [normalizeItem({
        id: firstTag(body, kind.toLowerCase() === "entry" ? "id" : "guid") || link,
        url: link,
        title,
        summary: firstTag(body, "description") || firstTag(body, "summary") || firstTag(body, "content"),
        publishedAt: firstTag(body, "pubDate") || firstTag(body, "published") || firstTag(body, "updated")
      }, sourceUrl)];
    });
  }
}
