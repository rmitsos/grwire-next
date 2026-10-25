import test from "node:test";
import assert from "node:assert/strict";
import {
  noiseRejectReason,
  NOISE_HARD_REJECT,
  isEventPiece,
  hasFigureOrDecisionSignal,
  isCyprusOnly,
  hasTelecomNetworkAngle,
  specSectionKeywordMatch,
  BACKFILL_MAX_AGE_HOURS,
  HOMEPAGE_BACKFILL_MIN_ITEMS,
  SECTION_NAV_WINDOW_DAYS,
} from "../src/feed-rules.js";
import { selectArticles, buildHomepageSections, computeNavVisibility } from "../src/public-data.js";
import { sourceForcedCategories, rankItems, DEFAULT_WATCH_RULES } from "../src/watch-rules.js";
import { WordPressSourceAdapter } from "../src/sources/wordpress.js";
import { parseGgttListing } from "../src/sources/ggtt.js";
import { scanMarket } from "../src/pipeline.js";

function row({ url, title, summary = "", publishedAt, sourceId, metadata = {} }) {
  return {
    canonical_url: url, title, summary, published_at: publishedAt,
    source_id: sourceId, source_url: url, score: 0, categories: [], relevance: [], metadata,
  };
}

// --- 1. Homepage backfill ---------------------------------------------------

test("buildHomepageSections backfills up to 12 items from up to 7 days old when fewer than 12 are <72h old", () => {
  const now = Date.now();
  const fresh = [{
    url: "https://a.test/fresh", title: "Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους", summary: "",
    sourceId: "fresh-src", categories: ["telco"], score: 20, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  }];
  const backfill = [{
    url: "https://a.test/backfill", title: "Ο ΑΔΜΗΕ ανακοίνωσε νέο υποσταθμό υψηλής τάσης", summary: "",
    sourceId: "backfill-src", categories: ["energy"], score: 50, publishedAt: new Date(now - BACKFILL_MAX_AGE_HOURS * 3_600_000 + 3_600_000).toISOString(), metadata: {},
  }];
  const tooOld = [{
    url: "https://a.test/too-old", title: "Παλιά είδηση για δίκτυο οπτικών ινών", summary: "",
    sourceId: "old-src", categories: ["telco"], score: 99, publishedAt: new Date(now - (BACKFILL_MAX_AGE_HOURS + 24) * 3_600_000).toISOString(), metadata: {},
  }];
  const result = buildHomepageSections([...fresh, ...backfill, ...tooOld], { now });
  const shown = [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean);
  assert.ok(shown.some((a) => a.url === "https://a.test/backfill"), "expected the <=7 day backfill item to be included");
  const backfillItem = shown.find((a) => a.url === "https://a.test/backfill");
  assert.equal(backfillItem.homepageBackfill, true);
  assert.ok(!shown.some((a) => a.url === "https://a.test/too-old"), "an item older than the 7-day backfill window must stay excluded");
});

test("buildHomepageSections does not backfill when 12+ items are already <72h old", () => {
  const now = Date.now();
  const freshItems = Array.from({ length: 12 }, (_, i) => ({
    url: `https://a.test/fresh-${i}`, title: `Νέο έργο δικτύου οπτικών ινών #${i}`, summary: "",
    sourceId: `fresh-src-${i}`, categories: ["telco"], score: 10, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  }));
  const backfillCandidate = {
    url: "https://a.test/backfill", title: "Ο ΑΔΜΗΕ ανακοίνωσε νέο υποσταθμό υψηλής τάσης", summary: "",
    sourceId: "backfill-src", categories: ["energy"], score: 999, publishedAt: new Date(now - 4 * 24 * 3_600_000).toISOString(), metadata: {},
  };
  const result = buildHomepageSections([...freshItems, backfillCandidate], { now });
  const shown = [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean);
  assert.ok(!shown.some((a) => a.url === "https://a.test/backfill"), "no backfill once 12 fresh items already exist");
});

test("lead selection prefers tier 1/3 sources and a figure/decision signal, falling back to backfill only with no fresh lead candidate", () => {
  const now = Date.now();
  const plain = {
    url: "https://a.test/plain", title: "Νέα υπηρεσία από εταιρεία τηλεπικοινωνιών", summary: "",
    sourceId: "infocom-telecoms", categories: ["telco"], score: 10, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  };
  const preferred = {
    url: "https://a.test/preferred", title: "Το ΕΕΤΤ εξέδωσε απόφαση €2 εκατ. για το φάσμα συχνοτήτων", summary: "",
    sourceId: "eett-press", categories: ["regulators"], score: 10, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  };
  const result = buildHomepageSections([plain, preferred], { now });
  assert.equal(result.lead?.url, "https://a.test/preferred");
});

// --- 2. Event / conference pieces -------------------------------------------

test("isEventPiece matches Summit/forum/ημερίδα/εκδήλωση/ΔΕΘ/βράβευση across case and Greek inflections", () => {
  for (const title of [
    "Vodafone Business Summit 2026",
    "Συνέδριο για το μέλλον των τηλεπικοινωνιών",
    "Digital Forum Athens 2026",
    "Ημερίδα για τα δίκτυα οπτικών ινών",
    "Εκδήλωση παρουσίασης του νέου δικτύου 5G",
    "Η ΔΕΗ στη 90η ΔΕΘ",
    "Βράβευση της Cosmote για την καινοτομία",
  ]) {
    assert.ok(isEventPiece(title), `expected "${title}" to be an event piece`);
  }
  assert.ok(!isEventPiece("Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους"));
});

test("hasFigureOrDecisionSignal detects a euro amount, a power figure, a νοικοκυριά count, a numbered γραμμή, or a decision word", () => {
  assert.ok(hasFigureOrDecisionSignal("επένδυση €50 εκατ. στο δίκτυο"));
  assert.ok(hasFigureOrDecisionSignal("νέος σταθμός αποθήκευσης 100 MW"));
  assert.ok(hasFigureOrDecisionSignal("1,5 εκατ. νοικοκυριά συνδέθηκαν στο δίκτυο"));
  assert.ok(hasFigureOrDecisionSignal("η γραμμή 3 του μετρό επεκτείνεται"));
  assert.ok(hasFigureOrDecisionSignal("απόφαση για νέο κανονισμό φάσματος"));
  assert.ok(!hasFigureOrDecisionSignal("συζήτηση για το μέλλον των τηλεπικοινωνιών"));
});

test("buildHomepageSections: an event piece without a figure/decision word never appears on the homepage", () => {
  const now = Date.now();
  const articles = [{
    url: "https://a.test/event", title: "Τηλεπικοινωνιακό Συνέδριο 2026 στην Αθήνα", summary: "",
    sourceId: "src-a", categories: ["telco"], score: 50, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  }];
  const dropped = [];
  const result = buildHomepageSections(articles, { now, onDrop: (_article, reason) => dropped.push(reason) });
  assert.equal(result.lead, null);
  assert.equal(result.recent.length, 0);
  assert.ok(dropped.some((r) => r.stage === "event_piece"));
});

test("buildHomepageSections: an event piece WITH a figure/decision word can appear on the homepage, but never as lead", () => {
  const now = Date.now();
  const eventWithFigure = {
    url: "https://a.test/event-figure", title: "Συνέδριο: ο ΑΔΜΗΕ ανακοινώνει επένδυση €200 εκατ. σε υποσταθμούς", summary: "",
    sourceId: "src-a", categories: ["energy"], score: 80, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  };
  const normal = {
    url: "https://a.test/normal", title: "Ο ΑΔΜΗΕ ανακοίνωσε νέο υποσταθμό υψηλής τάσης", summary: "",
    sourceId: "src-b", categories: ["energy"], score: 40, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  };
  const result = buildHomepageSections([eventWithFigure, normal], { now });
  assert.ok(result.lead, "expected a lead");
  assert.notEqual(result.lead.url, "https://a.test/event-figure", "an event piece, even with a figure, must never be the lead");
  const shown = [result.lead, ...result.recent, ...Object.values(result.columns).flat()];
  assert.ok(shown.some((a) => a.url === "https://a.test/event-figure"), "expected the event+figure piece to still appear somewhere on the homepage");
});

test("selectArticles: at most one event piece survives per section page, highest score kept, the rest dropped event_cap", () => {
  const rows = [
    row({ url: "https://a.test/ev1", title: "Telecom Innovation Summit 2026: νέο δίκτυο 5G παρουσίαση", sourceId: "src-a", publishedAt: new Date().toISOString() }),
    row({ url: "https://a.test/ev2", title: "Fibre Forum 2026: οπτικές ίνες και δίκτυο FTTH στην Ελλάδα", sourceId: "src-b", publishedAt: new Date().toISOString() }),
  ];
  const dropped = [];
  const articles = selectArticles(rows, { category: "telco", onDrop: (r, reason) => dropped.push({ url: r.canonical_url, reason }) });
  assert.equal(articles.length, 1, "expected exactly one event piece to survive the section page");
  assert.ok(dropped.some((d) => d.reason.stage === "event_cap"));
});

// --- 3. telecom-fibre network-angle requirement ------------------------------

test("hasTelecomNetworkAngle requires an actual network/technology/operator term", () => {
  assert.ok(hasTelecomNetworkAngle("Η ΕΕΤΤ ανακοίνωσε νέο κανονισμό"));
  assert.ok(hasTelecomNetworkAngle("Νέα υπηρεσία FTTH από τη Nova"));
  assert.ok(!hasTelecomNetworkAngle("Τηλεπικοινωνιακή εταιρεία παρουσιάζει νέα εργαλεία Gemini AI για την εξυπηρέτηση πελατών"));
  assert.ok(!hasTelecomNetworkAngle("Westnet: το νέο laptop Acer με οθόνη OLED"));
});

test("selectArticles drops a telco item with no network angle (telco_no_network_angle) when telco was its only category", () => {
  const rows = [row({
    url: "https://a.test/gemini",
    title: "Τηλεπικοινωνιακή εταιρεία παρουσιάζει νέα εργαλεία Gemini AI για την εξυπηρέτηση πελατών",
    sourceId: "src-a", publishedAt: new Date().toISOString(),
  })];
  const dropped = [];
  const articles = selectArticles(rows, { onDrop: (_row, reason) => dropped.push(reason) });
  assert.equal(articles.length, 0);
  assert.ok(dropped.some((r) => r.stage === "telco_no_network_angle"));
});

test("selectArticles keeps a telco item that has a real network angle (ΕΕΤΤ + FTTH)", () => {
  const rows = [row({
    url: "https://a.test/eett-ftth",
    title: "Η ΕΕΤΤ ανακοίνωσε νέο κανόνα για τις υπηρεσίες FTTH",
    sourceId: "src-a", publishedAt: new Date().toISOString(),
  })];
  const articles = selectArticles(rows, { category: "telco" });
  assert.equal(articles.length, 1);
});

// --- 4. Stock-market noise ----------------------------------------------------

const STOCK_MARKET_CASES = [
  { title: "Τιμή-στόχος €5 για τη μετοχή του ΟΤΕ από αναλυτές", rejected: true },
  { title: "Τιμής-στόχου αναθεώρηση για τη μετοχή της ΔΕΗ", rejected: true },
  { title: "Χρηματιστηριακή σύσταση buy για τον ΟΤΕ", rejected: true },
  { title: "Broker note: hold rating for Cosmote shares", rejected: true },
  { title: "The company will buy new network equipment this year", rejected: false },
  { title: "Η ΔΕΗ προχώρησε σε αγορά ιδίων μετοχών", rejected: true },
  { title: "Μέρισμα 0,40 ευρώ θα διανείμει η Vodafone", rejected: true },
  { title: "Αποτελέσματα: η Cosmote ανακοίνωσε κέρδη και αυξημένο EBITDA", rejected: false },
  { title: "Εξαγορά startup από τη Nova σε συμφωνία M&A", rejected: false },
  { title: "ΟΤΕ υπέγραψε σύμβαση και νέα επένδυση σε δίκτυα", rejected: false },
];

for (const { title, rejected } of STOCK_MARKET_CASES) {
  test(`noiseRejectReason stock-market case ${JSON.stringify(title)} is ${rejected ? "rejected" : "kept"}`, () => {
    const reason = noiseRejectReason({ title });
    if (rejected) assert.ok(reason, `expected "${title}" to be rejected, got null`);
    else assert.equal(reason, null, `expected "${title}" to be kept, got ${JSON.stringify(reason)}`);
  });
}

test("NOISE_HARD_REJECT.stock_market carries the plain-term broker-note/buyback list", () => {
  assert.deepEqual(NOISE_HARD_REJECT.stock_market, ["τιμη στοχο*", "τιμησ στοχου", "target price", "ιδιες μετοχεσ", "ιδιων μετοχων"]);
});

// --- 5. Tier-1 routing ---------------------------------------------------------

test("sourceForcedCategories forces regulators-policy for every tier-1 item, even with no topical keyword match", () => {
  const generic = { tier: 1, sourceId: "raaey-energy-announcements", title: "Η ΡΑΑΕΥ ανακοίνωσε διοικητικές αλλαγές στο προσωπικό της", summary: "" };
  assert.deepEqual(sourceForcedCategories(generic).map((m) => m.category), ["regulators"]);
});

test("sourceForcedCategories: a tier-1 item with a real rule match keeps that category primary, regulators stays secondary", () => {
  const topical = { tier: 1, sourceId: "raaey-energy-announcements", url: "https://raaey.test/a", title: "Η ΡΑΑΕΥ εξέδωσε απόφαση για τη διασύνδεση ΑΠΕ στο δίκτυο", summary: "" };
  const [ranked] = rankItems([topical], DEFAULT_WATCH_RULES);
  assert.deepEqual(ranked.relevance.map((m) => m.category), ["energy", "regulators"]);
});

test("sourceForcedCategories: a tier-1 item with no DEFAULT_WATCH_RULES match still gets a topical category via the broader §1 keywords", () => {
  const item = { tier: 1, sourceId: "ggtt-telecom-announcements", url: "https://ggtt.test/a", title: "Η ΓΓΤΤ ενέκρινε όρους χονδρικής πρόσβασης δικτύου", summary: "" };
  const [ranked] = rankItems([item], DEFAULT_WATCH_RULES);
  assert.ok(ranked, "expected the tier-1 item to survive rankItems");
  assert.deepEqual(ranked.relevance.map((m) => m.category), ["telco", "regulators"]);
});

test("rankItems no longer silently drops a tier-1 item that matches no DEFAULT_WATCH_RULES rule (the ΡΑΑΕΥ/ΓΓΤΤ root cause)", () => {
  const item = { tier: 1, sourceId: "ggtt-telecom-announcements", url: "https://ggtt.test/a", title: "Ανακοίνωση διοικητικής φύσης χωρίς τεχνικό περιεχόμενο", summary: "" };
  const [ranked] = rankItems([item], DEFAULT_WATCH_RULES);
  assert.ok(ranked, "expected the tier-1 item to survive rankItems instead of being filtered out");
  assert.ok(ranked.relevance.map((m) => m.category).includes("regulators"));
});

test("sourceForcedCategories is a no-op for a non-tier-1 item", () => {
  assert.deepEqual(sourceForcedCategories({ tier: 3, sourceId: "some-other-source", title: "Τυχαίος τίτλος" }), []);
  assert.deepEqual(sourceForcedCategories({ sourceId: "some-other-source", title: "Τυχαίος τίτλος" }), []);
});

test("specSectionKeywordMatch: at least one §1 keyword hit is enough (no 2-hit minimum, unlike the homepage-section override)", () => {
  assert.ok(specSectionKeywordMatch("χονδρική πρόσβαση δικτύου", "telecom-fibre"));
  assert.ok(!specSectionKeywordMatch("τυχαίο κείμενο χωρίς σχετικές λέξεις", "telecom-fibre"));
});

test("parseGgttListing: keeps only /posts/<slug> links, parses the Greek date, and strips the deadline prefix", () => {
  const html = `
    <nav><a href="/section/telecom">Τηλεπικοινωνίες</a></nav>
    <a href="/posts">Αρχική λίστα</a>
    <a href="/posts/spectrum-decision-2026">20 Οκτωβρίου 2026 Απόφαση για το φάσμα συχνοτήτων</a>
    <a href="/posts/public-consultation-closed">15 Σεπτεμβρίου 2026 Η προθεσμία έληξε: Δημόσια διαβούλευση για το 5G</a>
  `;
  const items = parseGgttListing(html, "https://ggtt.mindigital.gr/section/telecom");
  assert.equal(items.length, 2);
  const bySlug = Object.fromEntries(items.map((item) => [item.url, item]));

  const decision = bySlug["https://ggtt.mindigital.gr/posts/spectrum-decision-2026"];
  assert.ok(decision, "expected the spectrum-decision post");
  assert.equal(decision.title, "Απόφαση για το φάσμα συχνοτήτων");
  const athensDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date(decision.publishedAt));
  assert.equal(athensDate, "2026-10-20");

  const consultation = bySlug["https://ggtt.mindigital.gr/posts/public-consultation-closed"];
  assert.ok(consultation, "expected the public-consultation post");
  assert.equal(consultation.title, "Δημόσια διαβούλευση για το 5G");

  assert.ok(!items.some((item) => item.url.includes("/section/")), "nav links must be excluded");
  assert.ok(!items.some((item) => item.url.endsWith("/posts")), "the bare /posts index must be excluded");
});

test("WordPressSourceAdapter titleFilter keeps only posts whose title/summary match the configured terms (ΥΠΕΝ energy prefilter)", async () => {
  const posts = [
    { id: 1, link: "https://ypen.gov.gr/a", title: { rendered: "Νέος κανονισμός για τα φωτοβολταϊκά πάρκα" }, excerpt: { rendered: "" }, date_gmt: "2026-10-20T09:00:00" },
    { id: 2, link: "https://ypen.gov.gr/b", title: { rendered: "Ανακοίνωση για τη δασική νομοθεσία" }, excerpt: { rendered: "" }, date_gmt: "2026-10-20T09:00:00" },
  ];
  const fetch = async () => ({ ok: true, json: async () => posts });
  const adapter = new WordPressSourceAdapter({ fetch });
  const items = await adapter.load({ url: "https://ypen.gov.gr", categories: [7], titleFilter: ["φωτοβολταικ*", "ενεργει*"] });
  assert.equal(items.length, 1);
  assert.match(items[0].title, /φωτοβολταϊκά/);
});

test("WordPressSourceAdapter with no titleFilter keeps every post (unchanged behaviour for other sources)", async () => {
  const posts = [{ id: 1, link: "https://x.test/a", title: { rendered: "Τίτλος" }, excerpt: { rendered: "" }, date_gmt: "2026-10-20T09:00:00" }];
  const fetch = async () => ({ ok: true, json: async () => posts });
  const items = await new WordPressSourceAdapter({ fetch }).load({ url: "https://x.test" });
  assert.equal(items.length, 1);
});

test("scanMarket attaches each source's configured tier to its items", async () => {
  const fetch = async () => ({
    ok: true, url: "https://x.test/feed", headers: { get: () => "application/rss+xml" },
    text: async () => `<rss><channel>
      <item><title>Η ΡΑΑΕΥ ανακοίνωσε διοικητικές αλλαγές στο προσωπικό της</title><link>https://x.test/a</link><pubDate>2026-10-24T09:00:00Z</pubDate></item>
    </channel></rss>`,
  });
  const result = await scanMarket({ fetch, sources: [{ id: "tier1-src", tier: 1, type: "rss", url: "https://x.test/feed" }] });
  assert.equal(result.items.length, 1, "the tier-1 item must survive even with no DEFAULT_WATCH_RULES match");
  assert.ok(result.items[0].relevance.map((m) => m.category).includes("regulators"));
});

// --- 6. Cyprus-only items -------------------------------------------------------

test("isCyprusOnly: true for a Cyprus-only mention, false once Greece/Greek is also mentioned", () => {
  assert.ok(isCyprusOnly({ title: "Η Cyta ανακοίνωσε νέο δίκτυο στην Κύπρο", summary: "" }));
  assert.ok(!isCyprusOnly({ title: "Η Cyta και ο ΟΤΕ συνεργάζονται σε έργο Ελλάδας-Κύπρου", summary: "" }));
  assert.ok(!isCyprusOnly({ title: "Η Nova επεκτείνει το δίκτυο στην Ελλάδα", summary: "" }));
});

test("buildHomepageSections drops a Cyprus-only item (cyprus_only), but it still lists on its section page", () => {
  const now = Date.now();
  const article = {
    url: "https://a.test/cyprus", title: "Η Cyta ανακοίνωσε νέο δίκτυο FTTH στη Λευκωσία", summary: "",
    sourceId: "cyta-src", categories: ["telco"], score: 50, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  };
  const dropped = [];
  const result = buildHomepageSections([article], { now, onDrop: (_a, reason) => dropped.push(reason) });
  assert.equal(result.lead, null);
  assert.equal(result.recent.length, 0);
  assert.ok(dropped.some((r) => r.stage === "cyprus_only"));

  const rows = [row({ url: article.url, title: article.title, sourceId: article.sourceId, publishedAt: article.publishedAt })];
  const sectionArticles = selectArticles(rows, { category: "telco" });
  assert.equal(sectionArticles.length, 1, "a Cyprus-only item must still appear on its section page");
});

// --- 7. Nav visibility (tenders/regulators hidden until >=3 items) -------------

test("computeNavVisibility hides a section with fewer than 3 items in the 30-day window, shows it at 3+", () => {
  const now = Date.now();
  const makeItems = (count, category) => Array.from({ length: count }, (_, i) => ({
    url: `https://a.test/${category}-${i}`, categories: [category],
    publishedAt: new Date(now - i * 3_600_000).toISOString(),
  }));
  const twoTenders = makeItems(2, "tenders");
  const threeRegulators = makeItems(3, "regulators");
  const visibility = computeNavVisibility([...twoTenders, ...threeRegulators], { now });
  assert.deepEqual(visibility.tenders, { shown: false, count: 2 });
  assert.deepEqual(visibility.regulators, { shown: true, count: 3 });
});

test("computeNavVisibility only counts items within SECTION_NAV_WINDOW_DAYS (30 days)", () => {
  const now = Date.now();
  const withinWindow = Array.from({ length: 3 }, (_, i) => ({
    url: `https://a.test/in-${i}`, categories: ["tenders"], publishedAt: new Date(now - i * 3_600_000).toISOString(),
  }));
  const outsideWindow = {
    url: "https://a.test/out", categories: ["tenders"], publishedAt: new Date(now - (SECTION_NAV_WINDOW_DAYS + 5) * 24 * 3_600_000).toISOString(),
  };
  const visibility = computeNavVisibility([...withinWindow, outsideWindow], { now });
  assert.equal(visibility.tenders.count, 3, "the >30-day-old item must not count toward visibility");
});

test("computeNavVisibility with no articles (no DATABASE_URL) hides both tenders and regulators", () => {
  assert.deepEqual(computeNavVisibility([]), {
    tenders: { shown: false, count: 0 },
    regulators: { shown: false, count: 0 },
  });
});

// --- 8. home_cap de-duplication in the dump -------------------------------------

test("buildHomepageSections reports at most one drop per (url, stage), and a shown article never appears in drops", () => {
  const now = Date.now();
  // Three same-source items with a home_cap of 1 (ad-hoc per-source cap
  // override) force the 2nd/3rd to be checked (and previously re-reported)
  // across the recent AND columns passes.
  const articles = Array.from({ length: 3 }, (_, i) => ({
    url: `https://a.test/capped-${i}`, title: `Νέα επένδυση σε δίκτυα διανομής #${i}`, summary: "",
    sourceId: "capped-src", categories: ["energy"], score: 10 - i, publishedAt: new Date(now - 3_600_000).toISOString(), metadata: {},
  }));
  const dropped = [];
  const shownUrls = new Set();
  const result = buildHomepageSections(articles, {
    now,
    onDrop: (article, reason) => dropped.push({ url: article.url, stage: reason.stage }),
  });
  [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean).forEach((a) => shownUrls.add(a.url));

  const seen = new Set();
  for (const drop of dropped) {
    const key = `${drop.url}|${drop.stage}`;
    assert.ok(!seen.has(key), `duplicate (url, stage) drop reported: ${key}`);
    seen.add(key);
    assert.ok(!shownUrls.has(drop.url), `article ${drop.url} was shown but also reported as dropped`);
  }
});
