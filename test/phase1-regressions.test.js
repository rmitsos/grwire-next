import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_WATCH_RULES,
  rankItems,
  primarySector,
  scanMarket,
  collapseDuplicateArticles,
  normalizeTitle,
  RssSourceAdapter,
} from "../src/index.js";
import { canonicalizeUrl, cleanUrl } from "../src/sources/utils.js";
import { SOURCES } from "../config/sources.js";

// public-data.js imports "./database" without a ".js" extension, which Next's
// bundler tolerates but Node's native ESM loader does not. Import it lazily so
// that pre-existing issue cannot crash this whole file before the other
// regression tests below get to run.
async function loadBuildHomepageSections() {
  const mod = await import("../src/public-data.js");
  return mod.buildHomepageSections;
}

// Fixtures are copied verbatim (title/url/summary/publishedAt/sourceId) from a
// live `node scripts/scan.js` run on 2026-10-25, see /workspace/knowledge/grwire/plan.md.
const fixturePath = fileURLToPath(new URL("./fixtures/scan-2026-10-25.json", import.meta.url));
const { items: FIXTURE_ITEMS } = JSON.parse(readFileSync(fixturePath, "utf8"));
function byTitle(title) {
  const item = FIXTURE_ITEMS.find((candidate) => candidate.title === title);
  if (!item) throw new Error(`Fixture item not found: ${title}`);
  return item;
}

const RENTAL_TITLE = "Τι κατοικίες προτιμούν οι ενοικιαστές στην Ελλάδα το 2026";
const NORTH_SUBURBS_TITLE = "Σε ποιές περιοχές των Βορείων Προαστίων επενδύουν σε νέα οικιστικά έργα οι μεγάλοι όμιλοι";
const HOTEL_TITLE = "“Πράσινο φως” με αλλαγές για το νέο 5άστερο ξενοδοχείο στη Σόλωνος";
const DECATHLON_TITLE = "Decathlon: Το άλμα στον τζίρο, τα μερίσματα και τα σχέδια για επέκταση – Πού θα ανοίξει το νέο κατάστημα";
const AD_CAMPAIGN_TITLE = "Η πρώτη καμπάνια της Saatchi & Saatchi Greece για τη Vodafone - marketingweek.gr";
const GR_IT_TENDERS_TITLE = "Το 2027 οι διαγωνισμοί για την δεύτερη ηλεκτρική διασύνδεση Ελλάδας – Ιταλίας";
const GR_IT_SEABED_TITLE = "Τον Ιανουάριο η έρευνα βυθού για την ηλεκτρική διασύνδεση Ελλάδας – Ιταλίας";
const ADMIE_FOLEGANDROS_TITLE = "ΑΔΜΗΕ: Συνδέθηκε η Φολέγανδρος με το ηπειρωτικό ηλεκτρικό σύστημα";

const papoutsanisDividend = {
  url: "https://example.test/papoutsanis-merisma",
  title: "Παπουτσάνης: Διανομή μερίσματος 0,05 ευρώ ανά μετοχή",
  summary: "Η Παπουτσάνης ανακοίνωσε διανομή μερίσματος 0,05 ευρώ ανά μετοχή μετά την έγκριση της Γενικής Συνέλευσης, σύμφωνα με ανακοίνωση στο Χρηματιστήριο Αθηνών.",
  publishedAt: "2026-10-24T09:00:00.000Z",
};

const nbgDividend = {
  url: "https://example.test/ethniki-trapeza-merisma",
  title: "Εθνική Τράπεζα: Διανομή μερίσματος μετά τα ρεκόρ κέρδη του 2026",
  summary: "Η Εθνική Τράπεζα ανακοίνωσε διανομή μερίσματος στους μετόχους μετά τα ανακοινωθέντα αποτελέσματα και κέρδη έτους στο Χρηματιστήριο Αθηνών.",
  publishedAt: "2026-10-24T09:00:00.000Z",
};

const realTelecomItem = {
  url: "https://example.test/cosmote-ftth",
  title: "Η Cosmote επεκτείνει το δίκτυο FTTH με νέες οπτικές ίνες σε όλη την Ελλάδα",
  summary: "Η Cosmote ανακοίνωσε επέκταση δικτύου οπτικών ινών FTTH σε δεκάδες δήμους της Ελλάδας.",
  publishedAt: "2026-10-24T09:00:00.000Z",
};

const aktorInfra = {
  url: "https://example.test/aktor-concession",
  title: "AKTOR: Υπεγράφη σύμβαση παραχώρησης για νέο αυτοκινητόδρομο στην Ελλάδα",
  summary: "Η AKTOR υπέγραψε σύμβαση παραχώρησης για την κατασκευή νέου αυτοκινητόδρομου στην Ελλάδα.",
  publishedAt: "2026-10-24T09:00:00.000Z",
};

const INTERCONNECTION_INFLECTIONS = ["διασύνδεση", "διασυνδέσεις", "διασύνδεσης", "διασυνδέσεων", "interconnection"];

// --- 1. Relevance ------------------------------------------------------

test("rental housing story is rejected by every watch rule", () => {
  const ranked = rankItems([byTitle(RENTAL_TITLE)], DEFAULT_WATCH_RULES);
  assert.equal(ranked.length, 0);
});

test("North Suburbs residential investment story is rejected by every watch rule", () => {
  const ranked = rankItems([byTitle(NORTH_SUBURBS_TITLE)], DEFAULT_WATCH_RULES);
  assert.equal(ranked.length, 0);
});

test("5-star hotel lifestyle story is rejected by every watch rule", () => {
  const ranked = rankItems([byTitle(HOTEL_TITLE)], DEFAULT_WATCH_RULES);
  assert.equal(ranked.length, 0);
});

test("Decathlon retail dividend/store story does not qualify as finance", () => {
  const [ranked] = rankItems([byTitle(DECATHLON_TITLE)], DEFAULT_WATCH_RULES);
  const categories = ranked?.relevance.map((match) => match.category) || [];
  assert.ok(!categories.includes("finance"), `expected no finance match, got ${categories}`);
});

test("ad-campaign story does not qualify as finance just because its source name contains 'market'", () => {
  const [ranked] = rankItems([byTitle(AD_CAMPAIGN_TITLE)], DEFAULT_WATCH_RULES);
  const categories = ranked?.relevance.map((match) => match.category) || [];
  assert.ok(!categories.includes("finance"), `expected no finance match, got ${categories}`);
});

test("synthetic Papoutsanis dividend story is rejected for finance (not a monitored company)", () => {
  const [ranked] = rankItems([papoutsanisDividend], DEFAULT_WATCH_RULES);
  const categories = ranked?.relevance.map((match) => match.category) || [];
  assert.ok(!categories.includes("finance"), `expected no finance match, got ${categories}`);
});

test("a monitored company with a strong finance topic is still accepted as finance", () => {
  const [ranked] = rankItems([nbgDividend], DEFAULT_WATCH_RULES);
  const categories = ranked?.relevance.map((match) => match.category) || [];
  assert.ok(categories.includes("finance"), `expected a finance match, got ${categories}`);
});

test("Greece-Italy electrical interconnection stories are energy, not telecom", () => {
  for (const title of [GR_IT_TENDERS_TITLE, GR_IT_SEABED_TITLE]) {
    const [ranked] = rankItems([byTitle(title)], DEFAULT_WATCH_RULES);
    const categories = ranked?.relevance.map((match) => match.category) || [];
    assert.ok(!categories.includes("telco"), `"${title}" should not be telco, got ${categories}`);
    assert.ok(categories.includes("energy"), `"${title}" should be energy, got ${categories}`);
  }
});

test("ADMIE Folegandros grid-connection story is not telecom", () => {
  const [ranked] = rankItems([byTitle(ADMIE_FOLEGANDROS_TITLE)], DEFAULT_WATCH_RULES);
  const categories = ranked?.relevance.map((match) => match.category) || [];
  assert.ok(!categories.includes("telco"), `expected no telco match, got ${categories}`);
});

test("bare interconnection wording alone never qualifies as telecom", () => {
  for (const word of INTERCONNECTION_INFLECTIONS) {
    const item = {
      url: `https://example.test/interconnection-${encodeURIComponent(word)}`,
      title: `Νέα ${word} στο ηλεκτρικό σύστημα ανακοινώθηκε στην Ελλάδα`,
      summary: "Ανακοίνωση για έργο ηλεκτρικής διασύνδεσης στην Ελλάδα.",
      publishedAt: "2026-10-24T09:00:00.000Z",
    };
    const [ranked] = rankItems([item], DEFAULT_WATCH_RULES);
    const categories = ranked?.relevance.map((match) => match.category) || [];
    assert.ok(!categories.includes("telco"), `"${word}" should not trigger telco, got ${categories}`);
  }
});

test("a real telecom fibre-network story is still accepted as telco", () => {
  const [ranked] = rankItems([realTelecomItem], DEFAULT_WATCH_RULES);
  const categories = ranked?.relevance.map((match) => match.category) || [];
  assert.ok(categories.includes("telco"), `expected a telco match, got ${categories}`);
});

test("primarySector returns a single deterministic sector for GR-IT interconnection stories", () => {
  for (const title of [GR_IT_TENDERS_TITLE, GR_IT_SEABED_TITLE]) {
    assert.equal(primarySector(byTitle(title)), "energy");
  }
});

test("primarySector returns null for stories with no accepted watch rule", () => {
  assert.equal(primarySector(byTitle(HOTEL_TITLE)), null);
  assert.equal(primarySector(byTitle(RENTAL_TITLE)), null);
});

// --- 2. Dedupe ----------------------------------------------------------

test("canonicalizeUrl normalizes host casing, www, tracking params and amp markers", () => {
  const canonical = "https://ypodomes.com/to-2027-oi-diagonismoi-gia-tin-deyteri-ilektriki-diasyndesi-elladas-italias/";
  const variants = [
    "https://WWW.Ypodomes.com/to-2027-oi-diagonismoi-gia-tin-deyteri-ilektriki-diasyndesi-elladas-italias/?utm_source=rss&utm_medium=rss&utm_campaign=x",
    "https://ypodomes.com/to-2027-oi-diagonismoi-gia-tin-deyteri-ilektriki-diasyndesi-elladas-italias/?fbclid=abc&gclid=xyz&mc_cid=1&mc_eid=2&ref=rss",
    "https://ypodomes.com/to-2027-oi-diagonismoi-gia-tin-deyteri-ilektriki-diasyndesi-elladas-italias/amp",
    "https://ypodomes.com/to-2027-oi-diagonismoi-gia-tin-deyteri-ilektriki-diasyndesi-elladas-italias#comments",
  ];
  for (const variant of variants) {
    assert.equal(canonicalizeUrl(variant), canonicalizeUrl(canonical), variant);
  }
});

test("canonicalizeUrl decodes &amp; entities in query strings before stripping tracking params", () => {
  const withAmpEntity = "https://ypodomes.com/story/?utm_source=rss&amp;utm_medium=rss&amp;id=42";
  assert.equal(canonicalizeUrl(withAmpEntity), "https://ypodomes.com/story?id=42");
});

test("canonicalizeUrl lowercases only the host and drops www.", () => {
  assert.equal(
    canonicalizeUrl("https://WWW.Ypodomes.COM/Some-Story/?utm_source=rss"),
    "https://ypodomes.com/Some-Story",
  );
});

test("cleanUrl keeps www., path and trailing slash but strips tracking params, and still dedupes with the bare-host form via canonicalizeUrl", () => {
  const stored = cleanUrl("https://www.ot.gr/a/b/?utm_source=x");
  assert.equal(stored, "https://www.ot.gr/a/b/");
  assert.equal(canonicalizeUrl(stored), canonicalizeUrl("https://ot.gr/a/b"));
});

test("normalizeTitle strips trailing site-name suffixes", () => {
  const normalized = normalizeTitle(AD_CAMPAIGN_TITLE);
  assert.ok(!/marketingweek/i.test(normalized), `expected site suffix to be stripped, got "${normalized}"`);
});

test("normalizeTitle collapses accent- and case-only variants of the same headline", () => {
  const upper = normalizeTitle("ΑΔΜΗΕ: ΣΥΝΔΕΘΗΚΕ Η ΦΟΛΕΓΑΝΔΡΟΣ ΜΕ ΤΟ ΗΠΕΙΡΩΤΙΚΟ ΗΛΕΚΤΡΙΚΟ ΣΥΣΤΗΜΑ");
  const original = normalizeTitle(byTitle(ADMIE_FOLEGANDROS_TITLE).title);
  assert.equal(upper, original);
});

test("normalizeTitle collapses inflected Greek endings for the same storage story", () => {
  const withSuffix = normalizeTitle("Η ΔΕΗ ανακοίνωσε νέα επένδυση στην αποθήκευση ενέργειας - Ypodomes.com");
  const plain = normalizeTitle("Η ΔΕΗ ανακοινώνει νέες επενδύσεις στην αποθήκευση της ενέργειας");
  assert.equal(withSuffix, plain);
});

test("collapseDuplicateArticles merges the same headline reported with and without a site-name suffix", () => {
  const withSuffix = { url: "https://a.test/one", title: `${ADMIE_FOLEGANDROS_TITLE} - Ypodomes.com`, publishedAt: "2026-10-23T11:27:35.000Z" };
  const plain = { url: "https://b.test/two", title: ADMIE_FOLEGANDROS_TITLE, publishedAt: "2026-10-23T11:27:35.000Z" };
  const kept = collapseDuplicateArticles([withSuffix, plain]);
  assert.equal(kept.length, 1);
});

test("collapseDuplicateArticles merges inflected Greek headlines about the same story", () => {
  const withSuffix = { url: "https://a.test/dei-1", title: "Η ΔΕΗ ανακοίνωσε νέα επένδυση στην αποθήκευση ενέργειας - Ypodomes.com", publishedAt: "2026-10-24T08:00:00.000Z" };
  const plain = { url: "https://b.test/dei-2", title: "Η ΔΕΗ ανακοινώνει νέες επενδύσεις στην αποθήκευση της ενέργειας", publishedAt: "2026-10-24T09:00:00.000Z" };
  const kept = collapseDuplicateArticles([withSuffix, plain]);
  assert.equal(kept.length, 1);
});

test("collapseDuplicateArticles keeps genuinely different GR-IT interconnection stories separate", () => {
  const kept = collapseDuplicateArticles([byTitle(GR_IT_TENDERS_TITLE), byTitle(GR_IT_SEABED_TITLE)]);
  assert.equal(kept.length, 2);
});

test("scanMarket stores the canonical URL when the same article arrives via a tracked and a clean link", async () => {
  const fetch = async (url) => {
    const tracked = String(url).includes("tracked");
    return {
      ok: true,
      url: String(url),
      headers: { get: () => "application/rss+xml" },
      text: async () => (tracked
        ? `<rss><channel><item><title>${ADMIE_FOLEGANDROS_TITLE}</title><link>https://ypodomes.com/story?utm_source=rss&amp;utm_medium=rss</link><pubDate>2026-10-23T11:27:35Z</pubDate><description>ΑΔΜΗΕ αποθήκευση ενέργειας στην Ελλάδα, υποσταθμός.</description></item></channel></rss>`
        : `<rss><channel><item><title>${ADMIE_FOLEGANDROS_TITLE}</title><link>https://ypodomes.com/story</link><pubDate>2026-10-23T11:27:35Z</pubDate><description>ΑΔΜΗΕ αποθήκευση ενέργειας στην Ελλάδα, υποσταθμός.</description></item></channel></rss>`),
    };
  };
  const result = await scanMarket({
    fetch,
    sources: [
      { id: "tracked-source", type: "rss", url: "https://tracked.test/feed" },
      { id: "clean-source", type: "rss", url: "https://clean.test/feed" },
    ],
    rules: DEFAULT_WATCH_RULES,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].url, "https://ypodomes.com/story");
  assert.equal(result.items[0].originalUrl, "https://ypodomes.com/story?utm_source=rss&utm_medium=rss");
});

// --- 3. Per-source cap ---------------------------------------------------

const PLACES = [
  "Αττικής", "Θεσσαλονίκης", "Πάτρας", "Λάρισας", "Ηρακλείου", "Ιωαννίνων", "Βόλου", "Καβάλας",
  "Ρόδου", "Χανίων", "Κέρκυρας", "Σερρών", "Κοζάνης", "Αλεξανδρούπολης", "Τρικάλων", "Καλαμάτας",
  "Δράμας", "Κιλκίς", "Ξάνθης", "Έδεσσας", "Βέροιας", "Κατερίνης", "Λαμίας", "Χαλκίδας",
  "Κομοτηνής", "Σπάρτης", "Κορίνθου", "Ναυπλίου", "Αγρινίου", "Μεσολογγίου",
];

function rssItem(title, url, day) {
  return `<item><title>${title}</title><link>${url}</link><pubDate>2026-10-${String(day).padStart(2, "0")}T08:00:00Z</pubDate><description>Έργο αποθήκευσης ενέργειας στην Ελλάδα, υποσταθμός διασύνδεσης.</description></item>`;
}

test("scanMarket caps items from a single prolific source while keeping all of a smaller source's items", async () => {
  const bigItems = PLACES.map((place, i) =>
    rssItem(`ΔΕΗ ενεργειακή επένδυση διασύνδεσης στην περιοχή ${place} στην Ελλάδα`, `https://big.test/story-${i}`, 10 + (i % 15)),
  ).join("");
  const smallItems = PLACES.slice(0, 5).map((place, i) =>
    rssItem(`ΑΔΜΗΕ έργο διασύνδεσης στην περιοχή ${place} στην Ελλάδα`, `https://small.test/story-${i}`, 10 + i),
  ).join("");
  const fetch = async (url) => ({
    ok: true,
    url: String(url),
    headers: { get: () => "application/rss+xml" },
    text: async () => `<rss><channel>${String(url).includes("big") ? bigItems : smallItems}</channel></rss>`,
  });
  const result = await scanMarket({
    fetch,
    maxRelevantItems: 100,
    sources: [
      { id: "big-source", type: "rss", url: "https://big.test/feed" },
      { id: "small-source", type: "rss", url: "https://small.test/feed" },
    ],
    rules: DEFAULT_WATCH_RULES,
  });
  const bigCount = result.items.filter((item) => item.sourceId === "big-source").length;
  const smallCount = result.items.filter((item) => item.sourceId === "small-source").length;
  assert.ok(bigCount <= 12, `expected at most 12 items from the prolific source, got ${bigCount}`);
  assert.equal(smallCount, 5);
});

// --- 4. Homepage ---------------------------------------------------------

test("buildHomepageSections never repeats a URL and keeps each article in its primary-sector column only", async () => {
  const buildHomepageSections = await loadBuildHomepageSections();
  const fillerArticles = Array.from({ length: 13 }, (_, i) => ({
    url: `https://filler.test/article-${i}`,
    title: `Γενικό έργο υποδομών αρ. ${i} στην Ελλάδα`,
    categories: ["infrastructure"],
    publishedAt: `2026-10-${String(25 - i).padStart(2, "0")}T08:00:00.000Z`,
  }));

  const specialSourceItems = [
    byTitle(RENTAL_TITLE),
    byTitle(GR_IT_TENDERS_TITLE),
    byTitle(GR_IT_SEABED_TITLE),
    realTelecomItem,
    nbgDividend,
    aktorInfra,
  ];
  const ranked = rankItems(specialSourceItems, DEFAULT_WATCH_RULES);
  const categoriesByUrl = new Map(ranked.map((item) => [item.url, item.relevance.map((match) => match.category)]));
  const specialArticles = specialSourceItems
    .filter((item) => categoriesByUrl.has(item.url))
    .map((item) => ({
      url: item.url,
      title: item.title,
      categories: categoriesByUrl.get(item.url),
      publishedAt: item.publishedAt,
    }));

  const articles = [...fillerArticles, ...specialArticles];
  const sections = buildHomepageSections(articles);

  const allUrls = [
    sections.lead?.url,
    ...sections.recent.map((article) => article.url),
    ...Object.values(sections.columns).flatMap((column) => column.map((article) => article.url)),
  ].filter(Boolean);
  assert.equal(allUrls.length, new Set(allUrls).size, "no article should appear in more than one homepage section");

  for (const [category, column] of Object.entries(sections.columns)) {
    for (const article of column) {
      assert.equal(article.categories[0], category, `${article.url} should only live in its primary category's column`);
    }
  }

  const rentalUrl = byTitle(RENTAL_TITLE).url;
  assert.ok(!allUrls.includes(rentalUrl), "rental housing story must not appear anywhere on the homepage");

  for (const title of [GR_IT_TENDERS_TITLE, GR_IT_SEABED_TITLE]) {
    const url = byTitle(title).url;
    assert.ok(!sections.columns.telco.some((article) => article.url === url), `"${title}" must never land in the Telecom column`);
  }
});

// --- 5. Sources config ----------------------------------------------------

test("eett source config uses the working press-release RSS feed", () => {
  const eett = SOURCES.find((source) => source.id === "eett-announcements");
  assert.ok(eett, "expected the eett-announcements source");
  assert.equal(eett.type, "rss");
  assert.equal(eett.url, "https://www.eett.gr/feed/?post_type=deltia_tipou");
});

test("raaey source config uses the working WordPress REST endpoint with the spec's category list", () => {
  const raaey = SOURCES.find((source) => source.id === "raaey-energy-announcements");
  assert.ok(raaey, "expected the raaey-energy-announcements source");
  assert.equal(raaey.type, "wordpress");
  assert.equal(raaey.url, "https://www.raaey.gr/energeia");
  assert.deepEqual([...raaey.categories].sort((a, b) => a - b), [17, 108, 109, 110, 111]);
});

test("ot-gr source config switches to the WordPress REST endpoint with excerpts", () => {
  const otGr = SOURCES.find((source) => source.id === "ot-gr");
  assert.ok(otGr, "expected a source with id 'ot-gr'");
  assert.equal(otGr.type, "wordpress");
  assert.equal(otGr.url, "https://www.ot.gr");
  assert.ok(Array.isArray(otGr.categories) && otGr.categories.length > 0, "expected a non-empty categories list");
});

test("energypress source config is enabled and uses the working /rss feed", () => {
  const energypress = SOURCES.find((source) => source.id === "energypress");
  assert.ok(energypress, "expected an 'energypress' source");
  assert.equal(energypress.type, "rss");
  assert.equal(energypress.url, "https://energypress.gr/rss");
  assert.notEqual(energypress.enabled, false);
});

test("intracom-telecom-press, dnews-eett and google-news-greek-telco are disabled", () => {
  for (const id of ["intracom-telecom-press", "dnews-eett", "google-news-greek-telco"]) {
    const source = SOURCES.find((candidate) => candidate.id === id);
    assert.ok(source, `expected a source with id '${id}'`);
    assert.equal(source.enabled, false, `expected '${id}' to be disabled`);
  }
});

test("google-news-greek-energy stays enabled", () => {
  const source = SOURCES.find((candidate) => candidate.id === "google-news-greek-energy");
  assert.ok(source, "expected a source with id 'google-news-greek-energy'");
  assert.notEqual(source.enabled, false);
});

test("scanMarket never fetches a disabled source", async () => {
  const calledUrls = [];
  const fetch = async (url) => {
    calledUrls.push(String(url));
    return {
      ok: true,
      url: String(url),
      headers: { get: () => "application/rss+xml" },
      text: async () => "<rss><channel></channel></rss>",
    };
  };
  await scanMarket({
    fetch,
    sources: [
      { id: "enabled-source", type: "rss", url: "https://enabled.test/feed" },
      { id: "disabled-source", type: "rss", url: "https://disabled.test/feed", enabled: false },
    ],
    rules: DEFAULT_WATCH_RULES,
  });
  assert.ok(calledUrls.some((url) => url.includes("enabled.test")), "expected the enabled source to be fetched");
  assert.ok(!calledUrls.some((url) => url.includes("disabled.test")), "expected the disabled source not to be fetched");
});

test("RSS adapter drops EETT test posts via excludeTitlePatterns", async () => {
  const xml = `<rss><channel>
    <item><title>Τεστ 3</title><link>https://www.eett.gr/test-3</link><pubDate>2026-10-20T08:00:00Z</pubDate></item>
    <item><title>Απόφαση ΕΕΤΤ για αριθμοδότηση</title><link>https://www.eett.gr/decision-1</link><pubDate>2026-10-21T08:00:00Z</pubDate></item>
  </channel></rss>`;
  const adapter = new RssSourceAdapter({
    fetch: async () => ({
      ok: true,
      url: "https://www.eett.gr/feed/?post_type=deltia_tipou",
      headers: { get: () => "application/rss+xml" },
      text: async () => xml,
    }),
  });
  const items = await adapter.load({
    url: "https://www.eett.gr/feed/?post_type=deltia_tipou",
    excludeTitlePatterns: ["^Τεστ"],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Απόφαση ΕΕΤΤ για αριθμοδότηση");
});

// --- 6. Sections / URLs --------------------------------------------------

test("spec section ids map onto existing PUBLIC_CATEGORIES slugs, and redirects agree", async () => {
  const { PUBLIC_CATEGORIES, SECTION_SLUG_BY_SPEC_ID } = await import("../src/public-data.js");
  const { SECTION_REDIRECTS } = await import("../config/section-redirects.js");

  const existingSlugs = new Set(Object.keys(PUBLIC_CATEGORIES));
  assert.deepEqual(existingSlugs, new Set(["finance", "telco", "energy", "infrastructure"]));

  for (const [slug, config] of Object.entries(PUBLIC_CATEGORIES)) {
    assert.ok(config.specId, `expected a specId for '${slug}'`);
    assert.equal(SECTION_SLUG_BY_SPEC_ID[config.specId], slug);
  }

  assert.equal(SECTION_REDIRECTS.length, Object.keys(PUBLIC_CATEGORIES).length);
  for (const redirect of SECTION_REDIRECTS) {
    assert.equal(redirect.permanent, true);
    assert.ok(redirect.source.startsWith("/"));
    const destinationSlug = redirect.destination.replace(/^\//, "");
    assert.ok(existingSlugs.has(destinationSlug), `redirect destination '${redirect.destination}' must be an existing slug`);
    const specId = redirect.source.replace(/^\//, "");
    assert.equal(SECTION_SLUG_BY_SPEC_ID[specId], destinationSlug);
  }

  assert.ok(!SECTION_REDIRECTS.some((r) => r.source === "/tenders" || r.source === "/regulators"),
    "no /tenders or /regulators redirect should exist yet (Phase 2)");
});

test("PublicHeader and sitemap only link to existing public section slugs", () => {
  const headerSrc = readFileSync(fileURLToPath(new URL("../src/components/PublicHeader.js", import.meta.url)), "utf8");
  const sitemapSrc = readFileSync(fileURLToPath(new URL("../src/app/sitemap.js", import.meta.url)), "utf8");
  const existingSlugs = ["finance", "telco", "energy", "infrastructure"];
  const forbidden = ["tenders", "regulators", "telecom-fibre", "energy-grids", "infrastructure-works", "deals-companies"];
  for (const slug of forbidden) {
    assert.ok(!headerSrc.includes(`/${slug}`), `PublicHeader should not link to /${slug}`);
    assert.ok(!sitemapSrc.includes(`/${slug}`), `sitemap should not link to /${slug}`);
  }
  for (const slug of existingSlugs) {
    assert.ok(headerSrc.includes(`/${slug}`), `PublicHeader should link to /${slug}`);
    assert.ok(sitemapSrc.includes(`/${slug}`), `sitemap should link to /${slug}`);
  }
});
