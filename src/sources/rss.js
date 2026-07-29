import { absoluteUrl, firstTag, normalizeItem } from "./utils.js";

/** Parses RSS 2.0 and Atom feeds into the common source item shape. */
export class RssSourceAdapter {
  constructor(options = {}) { this.fetch = options.fetch || globalThis.fetch; }

  async load(source) {
    const response = await this.fetch(source.url, { headers: source.headers });
    if (!response.ok) throw new Error(`Feed request failed (${response.status})`);
    return this.parse(await response.text(), response.url || source.url);
  }

  parse(xml, sourceUrl) {
    const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
    return blocks.flatMap(([, kind, body]) => {
      let link = firstTag(body, "link");
      if (kind.toLowerCase() === "entry") {
        const alternate = body.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
        link = alternate?.[1] || link;
      }
      link = absoluteUrl(link, sourceUrl);
      if (!link) return [];
      return [normalizeItem({
        id: firstTag(body, kind.toLowerCase() === "entry" ? "id" : "guid") || link,
        url: link,
        title: firstTag(body, "title"),
        summary: firstTag(body, "description") || firstTag(body, "summary") || firstTag(body, "content"),
        publishedAt: firstTag(body, "pubDate") || firstTag(body, "published") || firstTag(body, "updated")
      }, sourceUrl)];
    });
  }
}
