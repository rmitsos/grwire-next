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
  buildDailyStory,
  buildFallbackDailyStory,
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

test("null article fields do not abort relevance scoring", () => {
  assert.doesNotThrow(() => rankItems([{ url: "https://news.test/empty", title: null, summary: null, metadata: { articleBody: null } }], DEFAULT_WATCH_RULES));
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

test("daily story builder produces an evidence-linked narrative", () => {
  const story = buildDailyStory({
    now: new Date("2026-08-31T10:00:00Z"),
    articles: [
      { id: "a", url: "https://one.test/a", title: "OTE expands FTTH and 5G investment in Greece", summary: "The operator plans new fibre network capacity.", sourceId: "ot", categories: ["telco"], score: 12 },
      { id: "b", url: "https://two.test/b", title: "Intracom Telecom launches AI-enabled FWA for operators", summary: "The platform automates network operations.", sourceId: "intracom", categories: ["telco"], score: 11 },
    ],
  });
  assert.match(story.headline, /telecoms/i);
  assert.equal(story.articleIds.length, 2);
  assert.equal(story.evidence.length, 2);
  assert.ok(story.body.some((paragraph) => paragraph.startsWith("Interpretation:")));
});

test("daily story collapses Greek and English copies of one event", () => {
  const story = buildDailyStory({
    now: new Date("2026-08-31T10:00:00Z"),
    articles: [
      { id: "en", url: "https://english.test/ote-ftth", title: "OTE invests in FTTH network in Greece", summary: "Investment in fibre infrastructure.", sourceId: "english", categories: ["telco"], score: 12, publishedAt: "2026-08-31T08:00:00Z" },
      { id: "el", url: "https://greek.test/ote-ftth", title: "ΟΤΕ επενδύει σε δίκτυο οπτικών ινών στην Ελλάδα", summary: "Επένδυση σε υποδομές δικτύου.", sourceId: "greek", categories: ["telco"], score: 10, publishedAt: "2026-08-31T09:00:00Z" },
      { id: "other", url: "https://other.test/5g", title: "Vodafone expands 5G coverage", summary: "New mobile network investment.", sourceId: "other", categories: ["telco"], score: 9, publishedAt: "2026-08-31T07:00:00Z" },
    ],
  });
  assert.equal(story.evidence.length, 2);
  assert.equal(story.evidence[0].id, "en");
});

test("fallback daily story is always evidence-linked", () => {
  const story = buildFallbackDailyStory({
    now: new Date("2026-09-03T10:00:00Z"),
    articles: [
      { id: "fresh", url: "https://source.test/fresh", title: "New Greek grid capacity tender announced", sourceId: "source", categories: ["energy"], score: 4, publishedAt: "2026-09-03T09:00:00Z" },
    ],
  });
  assert.equal(story.metadata.fallback, true);
  assert.deepEqual(story.articleIds, ["fresh"]);
  assert.equal(story.evidence[0].id, "fresh");
  assert.match(story.body[1], /New Greek grid capacity tender announced/);
});
