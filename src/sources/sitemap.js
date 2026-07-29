import { firstTag, normalizeItem } from "./utils.js";

/** Reads URL sets and recursively follows sitemap indexes with a bounded depth. */
export class SitemapSourceAdapter {
  constructor(options = {}) { this.fetch = options.fetch || globalThis.fetch; this.maxDepth = options.maxDepth ?? 2; }

  async load(source) { return this.#load(source.url, source.headers, 0, new Set()); }

  async #load(url, headers, depth, visited) {
    if (visited.has(url)) return [];
    if (depth > this.maxDepth) throw new Error(`Sitemap nesting exceeds maxDepth ${this.maxDepth}`);
    visited.add(url);
    const response = await this.fetch(url, { headers });
    if (!response.ok) throw new Error(`Sitemap request failed (${response.status})`);
    const xml = await response.text();
    if (/<sitemapindex\b/i.test(xml)) {
      const children = [...xml.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi)].map((m) => firstTag(m[1], "loc")).filter(Boolean);
      const pages = await Promise.all(children.map((child) => this.#load(new URL(child, url).href, headers, depth + 1, visited)));
      return pages.flat();
    }
    return [...xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)].flatMap(([, body]) => {
      const loc = firstTag(body, "loc");
      return loc ? [normalizeItem({ url: loc, title: loc, publishedAt: firstTag(body, "lastmod") }, url)] : [];
    });
  }
}
