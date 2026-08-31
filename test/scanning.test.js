import test from "node:test";
import assert from "node:assert/strict";
import {
  GdeltSourceAdapter,
  WordPressSourceAdapter,
  rankItems,
  scanMarket,
} from "../src/index.js";

test("WordPress adapter converts public posts without RSS", async () => {
  let requested;
  const fetch = async (url) => {
    requested = String(url);
    return {
      ok: true,
      json: async () => [{
        id: 7,
        link: "https://publisher.test/story",
        date_gmt: "2026-07-29T10:00:00",
        title: { rendered: "OTE expands FTTH in Greece" },
        excerpt: { rendered: "<p>New fibre deployment.</p>" },
      }],
    };
  };
  const [item] = await new WordPressSourceAdapter({ fetch }).load({
    url: "https://publisher.test",
    search: "OTE",
  });
  assert.match(requested, /wp-json\/wp\/v2\/posts/);
  assert.equal(item.title, "OTE expands FTTH in Greece");
  assert.equal(item.summary, "New fibre deployment.");
});

test("GDELT adapter normalizes discovery results", async () => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({
      articles: [{
        url: "https://news.test/ote",
        title: "OTE fibre investment",
        seendate: "20260729T120000Z",
        domain: "news.test",
        language: "Greek",
      }],
    }),
  });
  const [item] = await new GdeltSourceAdapter({ fetch }).load({ url: "https://gdelt.test", query: "OTE" });
  assert.equal(item.publishedAt, "2026-07-29T12:00:00.000Z");
  assert.equal(item.metadata.adapter, "gdelt");
});

test("watch rules rank specific market stories and reject weak matches", () => {
  const rule = {
    id: "ote",
    label: "OTE infrastructure",
    entities: ["OTE"],
    topics: ["FTTH"],
    geography: ["Greece"],
    threshold: 5,
  };
  const ranked = rankItems([
    { url: "https://x.test/1", title: "OTE expands FTTH", summary: "New network in Greece" },
    { url: "https://x.test/2", title: "General technology", summary: "News from Europe" },
  ], [rule]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].score, 10);
});

test("high-signal topics can qualify an article without a named company", () => {
  const ranked = rankItems([{
    url: "https://x.test/grid",
    title: "New electricity interconnection enters construction",
    summary: "",
  }], [{
    id: "grid",
    label: "Grid projects",
    strongTopics: ["interconnection"],
    threshold: 4,
  }]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].score, 5);
});

test("market scan isolates source failures and deduplicates tracking URLs", async () => {
  const fetch = async (url) => {
    if (String(url).includes("broken")) throw new Error("offline");
    return {
      ok: true,
      url: String(url),
      headers: { get: () => "application/rss+xml" },
      text: async () => `<rss><channel><item><title>OTE FTTH Greece</title><link>https://x.test/a?utm_source=one</link></item></channel></rss>`,
    };
  };
  const result = await scanMarket({
    fetch,
    sources: [
      { id: "one", type: "rss", url: "https://working.test/feed" },
      { id: "two", type: "rss", url: "https://broken.test/feed" },
    ],
    rules: [{ id: "ote", label: "OTE", entities: ["OTE"], topics: ["FTTH"], geography: ["Greece"], threshold: 5 }],
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.sources.filter((source) => !source.ok).length, 1);
  assert.equal(result.sources.find((source) => source.id === "one").accepted, 1);
  assert.equal(result.sources.find((source) => source.id === "one").rejected, 0);
});

test("article reading preselects relevant leads before opening pages", async () => {
  const requests = [];
  const fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("feed")) {
      return {
        ok: true,
        url: String(url),
        headers: { get: () => "application/rss+xml" },
        text: async () => `<rss><channel>
          <item><title>OTE expands FTTH in Greece</title><link>https://x.test/relevant</link></item>
          <item><title>Greek football club announces new coach</title><link>https://x.test/irrelevant</link></item>
        </channel></rss>`,
      };
    }
    return {
      ok: true,
      url: String(url),
      headers: { get: () => "text/html" },
      text: async () => `<html><head><meta name="description" content="A sufficiently detailed fibre infrastructure article for Greece."></head><body><article><p>OTE is expanding its FTTH network infrastructure across Greece with a major deployment programme.</p></article></body></html>`,
    };
  };
  const result = await scanMarket({
    fetch,
    readArticlePages: true,
    validateLinks: false,
    articleReadLimit: 1,
    sources: [{ id: "one", type: "rss", url: "https://working.test/feed" }],
    rules: [{ id: "ote", label: "OTE", entities: ["OTE"], topics: ["FTTH"], geography: ["Greece"], threshold: 5 }],
  });
  assert.equal(requests.filter((url) => url.includes("x.test/")).length, 1);
  assert.equal(result.items.length, 1);
  assert.match(result.items[0].url, /relevant/);
});
