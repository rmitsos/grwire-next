import { HtmlListingSourceAdapter } from "./html.js";
import { RssSourceAdapter } from "./rss.js";
import { SitemapSourceAdapter } from "./sitemap.js";
import { WordPressSourceAdapter } from "./wordpress.js";
import { GdeltSourceAdapter } from "./gdelt.js";

export {
  GdeltSourceAdapter,
  HtmlListingSourceAdapter,
  RssSourceAdapter,
  SitemapSourceAdapter,
  WordPressSourceAdapter,
};

export function createSourceAdapter(type, options) {
  if (type === "rss" || type === "atom") return new RssSourceAdapter(options);
  if (type === "sitemap") return new SitemapSourceAdapter(options);
  if (type === "html") return new HtmlListingSourceAdapter(options);
  if (type === "wordpress") return new WordPressSourceAdapter(options);
  if (type === "gdelt") return new GdeltSourceAdapter(options);
  throw new TypeError(`Unsupported source type: ${type}`);
}
