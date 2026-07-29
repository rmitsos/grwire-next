import test from "node:test";
import assert from "node:assert/strict";
import { HtmlListingSourceAdapter, RssSourceAdapter, SitemapSourceAdapter } from "../src/index.js";

test("RSS and Atom entries normalize to common items", () => {
  const xml = `<rss><channel><item><title>News &amp; Notes</title><link>https://x.test/a</link><guid>a</guid><description><![CDATA[<b>Hello</b>]]></description><pubDate>Wed, 01 Jan 2025 00:00:00 GMT</pubDate></item></channel></rss>`;
  const [item] = new RssSourceAdapter().parse(xml, "https://x.test/feed");
  assert.equal(item.title, "News & Notes"); assert.equal(item.summary, "Hello"); assert.equal(item.id, "a");
});

test("HTML adapter filters by link class and resolves relative URLs", () => {
  const html = `<a class="story featured" href="/one"><span>First</span></a><a href="/two">Second</a>`;
  const items = new HtmlListingSourceAdapter().parse(html, "https://x.test/list", { linkClass: "story" });
  assert.deepEqual(items.map(({ url, title }) => ({ url, title })), [{ url: "https://x.test/one", title: "First" }]);
});

test("sitemap adapter follows indexes", async () => {
  const pages = new Map([
    ["https://x.test/root.xml", `<sitemapindex><sitemap><loc>https://x.test/a.xml</loc></sitemap></sitemapindex>`],
    ["https://x.test/a.xml", `<urlset><url><loc>https://x.test/page</loc><lastmod>2025-01-01</lastmod></url></urlset>`]
  ]);
  const fetch = async (url) => ({ ok: true, url, text: async () => pages.get(url) });
  const [item] = await new SitemapSourceAdapter({ fetch }).load({ url: "https://x.test/root.xml" });
  assert.equal(item.url, "https://x.test/page");
});
