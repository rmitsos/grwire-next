import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDailyIntelligence,
  discoverSourceCandidates,
  inspectArticle,
  validateArticleLink,
} from "../src/index.js";

const rules = [{
  id: "telco",
  label: "Greek telecom infrastructure",
  entities: ["OTE"],
  topics: ["FTTH", "fiber"],
  geography: ["Greece"],
}];

test("Source Guardian accepts a relevant clean item and strips tracking parameters", () => {
  const result = inspectArticle({
    url: "https://newsource.test/story?utm_source=feed",
    title: "OTE expands FTTH infrastructure in Greece",
    summary: "The operator announced a new fibre deployment programme across several regions.",
  }, { rules });
  assert.equal(result.accepted, true);
  assert.equal(result.url.canonicalUrl, "https://newsource.test/story");
  assert.ok(result.subject.score >= 35);
});

test("Source Guardian rejects a clean but off-topic article", () => {
  const result = inspectArticle({
    url: "https://newsource.test/story",
    title: "Greek football club announces new coach",
    summary: "The club shared details about its summer training programme.",
  }, { rules });
  assert.equal(result.accepted, false);
});

test("link validation reports reachability without throwing", async () => {
  const result = await validateArticleLink({ url: "https://source.test/story" }, {
    fetch: async () => ({ ok: true, status: 200, url: "https://source.test/story", headers: { get: () => "text/html" } }),
  });
  assert.equal(result.status, "reachable");
  assert.equal(result.httpStatus, 200);
});

test("source discovery surfaces repeated relevant domains", () => {
  const candidates = discoverSourceCandidates([
    { url: "https://newsource.test/a", title: "OTE FTTH Greece", summary: "Fibre network expansion" },
    { url: "https://newsource.test/b", title: "OTE fiber project in Greece", summary: "Infrastructure programme" },
  ], { knownDomains: [] });
  assert.equal(candidates[0].domain, "newsource.test");
  assert.equal(candidates[0].occurrences, 2);
});

test("correlation agent produces a trend and independent-source correlation", () => {
  const articles = [
    { id: "a", url: "https://one.test/a", title: "OTE FTTH expansion in Greece", summary: "Network project", sourceId: "one", publishedAt: "2026-08-30T10:00:00Z", categories: ["telco"], relevance: [{ category: "telco", reasons: ["FTTH"] }], score: 9, organizations: ["ote"] },
    { id: "b", url: "https://two.test/b", title: "OTE fibre tender in Greece", summary: "New infrastructure tender", sourceId: "two", publishedAt: "2026-08-29T10:00:00Z", categories: ["telco"], relevance: [{ category: "telco", reasons: ["FTTH"] }], score: 8, organizations: ["ote"] },
  ];
  const intelligence = buildDailyIntelligence({ articles, now: new Date("2026-08-31T10:00:00Z") });
  assert.ok(intelligence.trends.length >= 1);
  assert.ok(intelligence.correlations.some((item) => item.interpretation === "independent corroboration"));
});
