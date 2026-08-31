import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDailyIntelligence,
  discoverSourceCandidates,
  inspectArticle,
  parseArticleHtml,
  validateArticleLink,
  collapseDuplicateArticles,
  rankItems,
  DEFAULT_WATCH_RULES,
} from "../src/index.js";
import { SOURCES } from "../config/sources.js";

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

test("article reader extracts first-party metadata and readable body", () => {
  const parsed = parseArticleHtml(`
    <html><head>
      <meta property="og:title" content="OTE launches a Greek FTTH project">
      <meta name="description" content="A new fibre programme was announced.">
      <meta property="article:published_time" content="2026-08-30T10:00:00Z">
      <link rel="canonical" href="https://publisher.test/original">
    </head><body><article><h1>Headline</h1>
      <p>This is a sufficiently long paragraph describing the infrastructure programme in Greece.</p>
    </article></body></html>`, "https://publisher.test/redirect");
  assert.equal(parsed.canonicalUrl, "https://publisher.test/original");
  assert.equal(parsed.title, "OTE launches a Greek FTTH project");
  assert.match(parsed.body, /infrastructure programme/);
  assert.equal(parsed.publishedAt, "2026-08-30T10:00:00.000Z");
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

test("telco rule requires an infrastructure subject, not just a telecom company", () => {
  const ranked = rankItems([
    { url: "https://news.test/consumer", title: "Vodafone announces new customer offer in Greece", summary: "A new mobile package for consumers." },
    { url: "https://news.test/fibre", title: "Vodafone expands FTTH fibre network in Greece", summary: "The infrastructure rollout covers new regions." },
  ], [{
    id: "telco", label: "Telco infrastructure", category: "telco", entities: ["Vodafone"], topics: ["network"],
    strongTopics: ["FTTH", "fibre"], requiredTopics: ["FTTH", "fibre"], minimumStrongTopics: 1,
    geography: ["Greece"], threshold: 4,
  }]);
  assert.equal(ranked.length, 1);
  assert.match(ranked[0].title, /FTTH/);
});

test("near-duplicate syndicated headlines collapse to the strongest item", () => {
  const result = collapseDuplicateArticles([
    { id: "a", title: "OTE announces major FTTH investment in Greece", publishedAt: "2026-08-30T10:00:00Z", score: 6, sourceId: "media-a" },
    { id: "b", title: "OTE announces major FTTH investment in Greece", publishedAt: "2026-08-30T11:00:00Z", score: 9, sourceId: "media-b" },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "b");
  assert.deepEqual(result[0].metadata.duplicateSources, ["media-a"]);
});

test("known non-telco examples do not enter the telco rule", () => {
  const examples = [
    "Motor Oil: Η μεγάλη επιστροφή στον MSCI",
    "Θερινές εκπτώσεις: Πότε πέφτει η αυλαία",
    "Axios: Τριμερής συνάντηση Πούτιν-Ζελένσκι-Τραμπ",
  ];
  const ranked = rankItems(examples.map((title, index) => ({
    url: `https://example.test/${index}`,
    title,
    summary: "",
  })), DEFAULT_WATCH_RULES);
  assert.equal(ranked.some((item) => item.relevance.some((match) => match.category === "telco")), false);
});

test("telecom regulation and mobile-billing stories enter telco", () => {
  const [item] = rankItems([{
    url: "https://www.dnews.gr/eidhseis/news-in-english/604487/example",
    title: "Greece tightens rules on mobile-billed digital services",
    summary: "",
    metadata: {
      articleBody: "The EETT revised its Code of Conduct for telecommunications bills and requires explicit consent for mobile-billed digital services.",
    },
  }], DEFAULT_WATCH_RULES);
  assert.equal(item.relevance[0].category, "telco");
  assert.ok(item.relevance[0].reasons.some((reason) => reason.includes("article")));
});

test("user-provided telecom indexes are registered as HTML sources", () => {
  assert.equal(SOURCES.find((source) => source.id === "netweek-telecoms")?.url, "https://netweek.gr/category/telecoms/");
  assert.equal(SOURCES.find((source) => source.id === "naftemporiki-telecoms")?.url, "https://www.naftemporiki.gr/tag/tilepikoinonies/");
  assert.equal(SOURCES.find((source) => source.id === "dnews-eett")?.type, "html");
  assert.equal(SOURCES.find((source) => source.id === "ot-telecoms")?.url, "https://www.ot.gr/category/epixeiriseis/tilepikoinonies/");
  assert.equal(SOURCES.find((source) => source.id === "intracom-telecom-press")?.url, "https://www.intracom-telecom.com/en/news/press.htm");
});
