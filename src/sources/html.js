import { absoluteUrl, fetchText, normalizeItem, stripTags } from "./utils.js";

/** Extracts listing links using a configurable container and link class. */
export class HtmlListingSourceAdapter {
  constructor(options = {}) { this.fetch = options.fetch || globalThis.fetch; }
  async load(source) {
    const result = await fetchText(this.fetch, source.url, {
      headers: source.headers,
      timeoutMs: source.timeoutMs,
      maxBytes: source.maxBytes,
      accept: "text/html, application/xhtml+xml",
    });
    return this.parse(result.text, result.url, source).slice(0, source.limit || 100);
  }
  parse(html, sourceUrl, config = {}) {
    const className = config.linkClass;
    const anchors = [...html.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
    const items = anchors.flatMap(([, before, href, after, contents]) => {
      const attrs = `${before} ${after}`;
      const classes = attrs.match(/class=["']([^"']*)["']/i)?.[1].split(/\s+/) || [];
      if (className && !classes.includes(className)) return [];
      const url = absoluteUrl(href, sourceUrl);
      if (!url || !/^https?:/.test(url)) return [];
      if (url.includes("#")) return [];
      if (url.replace(/\/$/, "") === sourceUrl.replace(/\/$/, "")) return [];
      const title = stripTags(contents) || attrs.match(/title=["']([^"']+)["']/i)?.[1];
      if (!title || /^https?:\/\//i.test(title) || title.trim().length < (config.minimumTitleLength || 0)) return [];
      if (config.linkPatterns?.length) {
        const haystack = `${url} ${title || ""}`.toLocaleLowerCase("el");
        if (!config.linkPatterns.some((pattern) => haystack.includes(String(pattern).toLocaleLowerCase("el")))) return [];
        if (config.excludePatterns?.some((pattern) => haystack.includes(String(pattern).toLocaleLowerCase("el")))) return [];
      }
      return [normalizeItem({ url, title }, sourceUrl)];
    });
    const unique = new Map();
    for (const item of items) {
      const previous = unique.get(item.url);
      if (!previous || previous.title === previous.url || item.title.length > previous.title.length) unique.set(item.url, item);
    }
    return [...unique.values()];
  }
}
