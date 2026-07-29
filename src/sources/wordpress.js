import { normalizeItem, stripTags } from "./utils.js";

/**
 * Uses WordPress' public REST interface rather than RSS. The configured URL
 * may be a site root or a full /wp-json/wp/v2/posts endpoint.
 */
export class WordPressSourceAdapter {
  constructor(options = {}) {
    this.fetch = options.fetch || globalThis.fetch;
  }

  async load(source) {
    const endpoint = wordpressEndpoint(source.url);
    const url = new URL(endpoint);
    url.searchParams.set("per_page", String(Math.min(source.limit || 25, 100)));
    url.searchParams.set("_fields", "id,link,date_gmt,modified_gmt,title,excerpt");
    if (source.after) url.searchParams.set("after", new Date(source.after).toISOString());
    if (source.search) url.searchParams.set("search", source.search);
    if (source.categories?.length) url.searchParams.set("categories", source.categories.join(","));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), source.timeoutMs || 10_000);
    try {
      const response = await this.fetch(url, {
        headers: {
          "User-Agent": "GRWire/0.2 (+https://grwire.com)",
          Accept: "application/json",
          ...source.headers,
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`WordPress request failed (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("WordPress returned an unexpected payload");
      return rows.map((post) =>
        normalizeItem(
          {
            id: String(post.id),
            url: post.link,
            title: post.title?.rendered,
            summary: post.excerpt?.rendered,
            publishedAt: post.date_gmt || post.modified_gmt,
            metadata: { adapter: "wordpress" },
          },
          source.url,
        ),
      );
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("WordPress request timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function wordpressEndpoint(value) {
  const url = new URL(value);
  if (url.pathname.includes("/wp-json/")) return url.href;
  url.pathname = `${url.pathname.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
  return url.href;
}
