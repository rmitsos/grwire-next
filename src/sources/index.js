import { HtmlListingSourceAdapter } from "./html.js";
import { HtmlScrapeSourceAdapter, buildMonthUrls, athensDateParts } from "./html-scrape.js";
import { RssSourceAdapter } from "./rss.js";
import { SitemapSourceAdapter } from "./sitemap.js";
import { WordPressSourceAdapter } from "./wordpress.js";
import { GdeltSourceAdapter } from "./gdelt.js";
import { GgttSourceAdapter, parseGgttListing } from "./ggtt.js";

export {
  GdeltSourceAdapter,
  GgttSourceAdapter,
  HtmlListingSourceAdapter,
  HtmlScrapeSourceAdapter,
  RssSourceAdapter,
  SitemapSourceAdapter,
  WordPressSourceAdapter,
  buildMonthUrls,
  athensDateParts,
  parseGgttListing,
};

export function createSourceAdapter(type, options) {
  if (type === "rss" || type === "atom") return new RssSourceAdapter(options);
  if (type === "sitemap") return new SitemapSourceAdapter(options);
  if (type === "html") return new HtmlListingSourceAdapter(options);
  if (type === "html-scrape") return new HtmlScrapeSourceAdapter(options);
  if (type === "wordpress") return new WordPressSourceAdapter(options);
  if (type === "gdelt") return new GdeltSourceAdapter(options);
  if (type === "ggtt") return new GgttSourceAdapter(options);
  throw new TypeError(`Unsupported source type: ${type}`);
}
