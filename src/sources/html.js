import { absoluteUrl, normalizeItem, stripTags } from "./utils.js";

/** Extracts listing links using a configurable container and link class. */
export class HtmlListingSourceAdapter {
  constructor(options = {}) { this.fetch = options.fetch || globalThis.fetch; }
  async load(source) {
    const response = await this.fetch(source.url, { headers: source.headers });
    if (!response.ok) throw new Error(`HTML request failed (${response.status})`);
    return this.parse(await response.text(), response.url || source.url, source);
  }
  parse(html, sourceUrl, config = {}) {
    const className = config.linkClass;
    const anchors = [...html.matchAll(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)];
    return anchors.flatMap(([, before, href, after, contents]) => {
      const attrs = `${before} ${after}`;
      const classes = attrs.match(/class=["']([^"']*)["']/i)?.[1].split(/\s+/) || [];
      if (className && !classes.includes(className)) return [];
      const url = absoluteUrl(href, sourceUrl);
      if (!url || !/^https?:/.test(url)) return [];
      const title = stripTags(contents) || attrs.match(/title=["']([^"']+)["']/i)?.[1];
      return [normalizeItem({ url, title }, sourceUrl)];
    });
  }
}
