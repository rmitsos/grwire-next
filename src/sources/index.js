import { HtmlListingSourceAdapter } from "./html.js";
import { RssSourceAdapter } from "./rss.js";
import { SitemapSourceAdapter } from "./sitemap.js";

export { HtmlListingSourceAdapter, RssSourceAdapter, SitemapSourceAdapter };

export function createSourceAdapter(type, options) {
  if (type === "rss" || type === "atom") return new RssSourceAdapter(options);
  if (type === "sitemap") return new SitemapSourceAdapter(options);
  if (type === "html") return new HtmlListingSourceAdapter(options);
  throw new TypeError(`Unsupported source type: ${type}`);
}
