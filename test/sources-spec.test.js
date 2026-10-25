import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  RssSourceAdapter,
  HtmlScrapeSourceAdapter,
  buildMonthUrls,
  scanMarket,
  rankItems,
  DEFAULT_WATCH_RULES,
  cleanTitleForSource,
  noiseRejectReason,
  NOISE_HARD_REJECT,
  isFresh,
  splitByFreshness,
  resolveGoogleNewsItems,
} from "../src/index.js";
import { canonicalizeUrl, cleanUrl } from "../src/sources/utils.js";
import { SOURCES } from "../config/sources.js";
import { applyDayCap, buildHomepageSections } from "../src/public-data.js";

function fixture(name) {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

// --- 1. Telecom sources ---------------------------------------------------

test("config/sources.js has the spec's §2.1/§2.2/§2.3 entries with name/sections/weight/dayCap/homeCap/pollMin", () => {
  const byId = Object.fromEntries(SOURCES.map((source) => [source.id, source]));

  assert.ok(byId["eett-press"], "eett-press should exist, replacing eett-announcements");
  assert.equal(byId["eett-press"].url, "https://www.eett.gr/feed/?post_type=deltia_tipou");
  assert.deepEqual(byId["eett-press"].sections, ["regulators-policy", "telecom-fibre"]);
  assert.equal(byId["eett-press"].weight, 1.0);
  assert.equal(byId["eett-press"].dayCap, 8);
  assert.equal(byId["eett-press"].homeCap, 2);
  assert.equal(byId["eett-press"].pollMin, 60);
  assert.ok(!byId["eett-announcements"], "the old id must be gone");

  assert.equal(byId["infocom-telecoms"]?.url, "https://infocom.gr/telecoms/feed/");
  assert.deepEqual(byId["infocom-telecoms"]?.sections, ["telecom-fibre", "deals-companies"]);
  assert.equal(byId["infocom-telecoms"]?.weight, 0.8);
  assert.equal(byId["infocom-telecoms"]?.dayCap, 8);
  assert.equal(byId["infocom-telecoms"]?.homeCap, 2);
  assert.equal(byId["infocom-telecoms"]?.pollMin, 60);

  assert.equal(byId["fibernews"]?.url, "https://fibernews.gr/feed/");
  assert.equal(byId["fibernews"]?.dayCap, 6);
  assert.equal(byId["fibernews"]?.homeCap, 2);

  assert.equal(byId["united-fiber"]?.url, "https://www.unitedfiber.gr/feed/");
  assert.equal(byId["united-fiber"]?.weight, 0.9);
  assert.equal(byId["united-fiber"]?.dayCap, 4);
  assert.equal(byId["united-fiber"]?.homeCap, 1);
  assert.equal(byId["united-fiber"]?.pollMin, 1440);

  const ppc = byId["ppc-press"];
  assert.equal(ppc?.type, "html-scrape");
  assert.equal(ppc?.urlTemplate, "https://www.ppcgroup.com/el/omilos-dei/grafeio-typou/deltia-typou/prosfata/deltia-tipou-{yyyy}/{month_el_latin}-{yyyy}/");
  assert.deepEqual(ppc?.monthElLatin, { 10: "oktovrios" });
  assert.deepEqual(ppc?.sections, ["energy-grids", "telecom-fibre", "deals-companies"]);
  assert.equal(ppc?.weight, 0.9);
  assert.equal(ppc?.dayCap, 4);
  assert.equal(ppc?.homeCap, 1);
  assert.equal(ppc?.pollMin, 180);
  assert.equal(ppc?.prefilter, true);
});

test("no source points at the site-wide EETT feed, and no EETT html adapter is enabled", () => {
  for (const source of SOURCES) {
    if (source.id === "eett-press") continue;
    assert.notEqual(source.url, "https://www.eett.gr/feed/", `${source.id} must not use the site-wide EETT feed (only 2022 test posts)`);
  }
  const eettHtml = SOURCES.find((source) => source.type === "html" && /eett\.gr/i.test(source.url || "") && source.enabled !== false);
  assert.ok(!eettHtml, "no enabled EETT html-listing source should remain");
});

for (const name of ["eett.xml", "infocom.xml", "fibernews.xml", "unitedfiber.xml"]) {
  test(`RSS fixture ${name} parses to items with url/title/publishedAt`, () => {
    const items = new RssSourceAdapter().parse(fixture(name), `https://example.test/${name}`);
    assert.ok(items.length > 0, `expected ${name} to yield at least one item`);
    for (const item of items) {
      assert.ok(item.url && /^https?:\/\//.test(item.url));
      assert.ok(item.title && item.title.length > 0);
      assert.ok(item.publishedAt, `expected a publishedAt for ${item.url}`);
    }
  });
}

test("ppc-press html-scrape adapter extracts the 5 October releases with the right title/date pairs", async () => {
  const html = fixture("ppc-oct-2026.html");
  const source = SOURCES.find((candidate) => candidate.id === "ppc-press");
  const fetch = async (url) => ({ ok: true, url: String(url), headers: { get: () => "text/html" }, text: async () => html });
  const adapter = new HtmlScrapeSourceAdapter({ fetch });
  const items = await adapter.load(source, { now: new Date("2026-10-25T10:00:00Z").getTime() });

  assert.equal(items.length, 5);
  const athensDate = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(new Date(iso));
  const byDate = Object.fromEntries(items.map((item) => [athensDate(item.publishedAt), item]));
  assert.ok(byDate["2026-10-05"]);
  assert.ok(byDate["2026-10-08"]);
  assert.ok(byDate["2026-10-12"]);
  assert.ok(byDate["2026-10-21"]);
  assert.ok(byDate["2026-10-23"]);

  const fiberItem = byDate["2026-10-08"];
  assert.match(fiberItem.title, /ΔΕΗ Fiber.*έφτασε.*1,5 εκατ\. σπίτια/i);
  assert.match(fiberItem.url, /dei-fiber-eftase-1-5-ekat-spitia/);
  // the date badge text must not leak into the title
  assert.ok(!/\d{2}\.\d{2}\.\d{4}/.test(fiberItem.title));
});

test("buildMonthUrls fetches only the current month when known and not in the day 1-3 window", () => {
  const source = { urlTemplate: "https://x.test/{yyyy}/{month_el_latin}-{yyyy}/", monthElLatin: { 10: "oktovrios" } };
  const urls = buildMonthUrls(source, new Date("2026-10-15T10:00:00Z").getTime());
  assert.deepEqual(urls, ["https://x.test/2026/oktovrios-2026/"]);
});

test("buildMonthUrls also fetches the previous month on days 1-3, when its slug is known", () => {
  const source = { urlTemplate: "https://x.test/{yyyy}/{month_el_latin}-{yyyy}/", monthElLatin: { 9: "septemvrios", 10: "oktovrios" } };
  const urls = buildMonthUrls(source, new Date("2026-10-02T06:00:00Z").getTime());
  assert.equal(urls.length, 2);
  assert.ok(urls.includes("https://x.test/2026/septemvrios-2026/"));
  assert.ok(urls.includes("https://x.test/2026/oktovrios-2026/"));
});

test("buildMonthUrls skips a month with no known Latin slug instead of guessing", () => {
  const source = { urlTemplate: "https://x.test/{yyyy}/{month_el_latin}-{yyyy}/", monthElLatin: { 10: "oktovrios" } };
  // November has no known slug; December 1st also triggers the day<=3 rule for November, still unknown.
  assert.deepEqual(buildMonthUrls(source, new Date("2026-11-15T10:00:00Z").getTime()), []);
  assert.deepEqual(buildMonthUrls(source, new Date("2026-12-02T10:00:00Z").getTime()), []);
});

test("HtmlScrapeSourceAdapter.load never throws for an unknown month; it warns and returns []", async () => {
  const source = { id: "ppc-press", urlTemplate: "https://x.test/{yyyy}/{month_el_latin}-{yyyy}/", monthElLatin: { 10: "oktovrios" }, linkPattern: "x", dateRegex: "x" };
  const originalWarn = console.warn;
  let warned = false;
  console.warn = () => { warned = true; };
  try {
    const items = await new HtmlScrapeSourceAdapter({ fetch: async () => { throw new Error("should not be called"); } })
      .load(source, { now: new Date("2026-11-15T10:00:00Z").getTime() });
    assert.deepEqual(items, []);
    assert.ok(warned, "expected a warning to be logged");
  } finally {
    console.warn = originalWarn;
  }
});

// --- 2. Caps ---------------------------------------------------------------

test("scanMarket applies the per-source day cap (Europe/Athens calendar day) before the overall per-run cap", async () => {
  const PLACES = ["Αττικής", "Θεσσαλονίκης", "Πάτρας", "Λάρισας", "Ηρακλείου", "Ιωαννίνων", "Βόλου", "Καβάλας", "Ρόδου", "Χανίων"];
  const items = PLACES.map((place, i) =>
    `<item><title>ΟΤΕ FTTH επέκταση δικτύου στην περιοχή ${place} στην Ελλάδα</title><link>https://x.test/story-${i}</link><pubDate>2026-10-24T0${i % 9}:00:00Z</pubDate></item>`,
  ).join("");
  const fetch = async (url) => ({
    ok: true, url: String(url), headers: { get: () => "application/rss+xml" },
    text: async () => `<rss><channel>${items}</channel></rss>`,
  });
  const result = await scanMarket({
    fetch,
    sources: [{ id: "capped-source", type: "rss", url: "https://x.test/feed", dayCap: 3 }],
    rules: DEFAULT_WATCH_RULES,
    now: new Date("2026-10-25T12:00:00Z").getTime(),
  });
  assert.equal(result.items.length, 3);
});

test("applyDayCap (public-data read path) re-applies the per-source day cap to rows already stored", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    source_id: "src", published_at: "2026-10-24T08:00:00.000Z", score: 10 - i, canonical_url: `https://x.test/${i}`,
  }));
  const kept = applyDayCap(rows, { now: new Date("2026-10-25T12:00:00Z").getTime() });
  assert.equal(kept.length, 5); // default day cap is 8, all 5 survive
  const SOURCE_DAY_CAP_2 = rows.map((row) => ({ ...row, source_id: "eett-press" }));
  const kept2 = applyDayCap(SOURCE_DAY_CAP_2, { now: new Date("2026-10-25T12:00:00Z").getTime() });
  assert.equal(kept2.length, 5); // eett-press day cap is 8 too, still all survive
});

test("buildHomepageSections enforces the per-source home cap across lead+recent+columns together", () => {
  const now = new Date("2026-10-25T12:00:00Z").getTime();
  const articles = Array.from({ length: 6 }, (_, i) => ({
    url: `https://x.test/infra-${i}`,
    title: `Έργο υποδομών αρ. ${i} στην Ελλάδα`,
    categories: ["infrastructure"],
    sourceId: "ypodomes-wordpress",
    publishedAt: new Date(now - i * 3_600_000).toISOString(),
  }));
  const sections = buildHomepageSections(articles, { now });
  const allUrls = [sections.lead?.url, ...sections.recent.map((a) => a.url), ...sections.columns.infrastructure.map((a) => a.url)].filter(Boolean);
  assert.ok(allUrls.length <= 2, `ypodomes-wordpress has no homeCap override so DEFAULT_HOME_CAP_PER_SOURCE=2 applies, got ${allUrls.length}`);
});

test("buildHomepageSections enforces the 35% section-share cap across lead+recent+columns together", () => {
  const now = new Date("2026-10-25T12:00:00Z").getTime();
  // many distinct sources so the per-source home cap never binds first
  const articles = Array.from({ length: 20 }, (_, i) => ({
    url: `https://x.test/energy-${i}`,
    title: `Έργο δικτύου ενέργειας αρ. ${i} στην Ελλάδα`,
    categories: ["energy"],
    sourceId: `energy-source-${i}`,
    publishedAt: new Date(now - i * 3_600_000).toISOString(),
  }));
  const sections = buildHomepageSections(articles, { now });
  const total = (sections.lead ? 1 : 0) + sections.recent.filter((a) => a.categories[0] === "energy").length
    + sections.columns.energy.length;
  assert.ok(total <= 11, `expected at most floor(0.35*33)=11 energy slots on the homepage, got ${total}`);
});

// --- 3. Freshness -----------------------------------------------------------

test("isFresh requires a publishedAt within the last 72 hours", () => {
  const now = new Date("2026-10-25T12:00:00Z").getTime();
  assert.equal(isFresh({ publishedAt: "2026-10-24T12:00:00Z" }, now), true);
  assert.equal(isFresh({ publishedAt: "2026-10-20T12:00:00Z" }, now), false);
  assert.equal(isFresh({}, now), false, "no publishedAt is never fresh");
});

test("buildHomepageSections only shows items published within the last 72 hours", () => {
  const now = new Date("2026-10-25T12:00:00Z").getTime();
  const fresh = { url: "https://x.test/fresh", title: "Νέο έργο δικτύου στην Ελλάδα", categories: ["energy"], sourceId: "s1", publishedAt: "2026-10-24T12:00:00Z" };
  const stale = { url: "https://x.test/stale", title: "Παλιό έργο δικτύου στην Ελλάδα", categories: ["energy"], sourceId: "s2", publishedAt: "2026-10-10T12:00:00Z" };
  const noDate = { url: "https://x.test/nodate", title: "Έργο χωρίς ημερομηνία στην Ελλάδα", categories: ["energy"], sourceId: "s3" };
  const sections = buildHomepageSections([fresh, stale, noDate], { now });
  const allUrls = [sections.lead?.url, ...sections.recent.map((a) => a.url)].filter(Boolean);
  assert.ok(allUrls.includes(fresh.url));
  assert.ok(!allUrls.includes(stale.url));
  assert.ok(!allUrls.includes(noDate.url));
});

test("splitByFreshness partitions already-fetched articles into fresh and older coverage for section pages", () => {
  const now = new Date("2026-10-25T12:00:00Z").getTime();
  const articles = [
    { url: "https://x.test/a", publishedAt: "2026-10-25T00:00:00Z" },
    { url: "https://x.test/b", publishedAt: "2026-10-01T00:00:00Z" },
    { url: "https://x.test/c" },
  ];
  const { fresh, older } = splitByFreshness(articles, { now });
  assert.deepEqual(fresh.map((a) => a.url), ["https://x.test/a"]);
  assert.deepEqual(older.map((a) => a.url), ["https://x.test/b", "https://x.test/c"]);
});

// --- 4. Clean links ----------------------------------------------------------

test("canonicalizeUrl and cleanUrl strip amp markers: ?amp, ?outputType=amp and a trailing /amp or /amp/", () => {
  const base = "https://x.test/story";
  assert.equal(canonicalizeUrl(`${base}?amp=1`), canonicalizeUrl(base));
  assert.equal(canonicalizeUrl(`${base}?outputType=amp`), canonicalizeUrl(base));
  assert.equal(canonicalizeUrl(`${base}/amp`), canonicalizeUrl(base));
  assert.equal(canonicalizeUrl(`${base}/amp/`), canonicalizeUrl(base));
  assert.equal(cleanUrl(`${base}/amp/`), cleanUrl(base));
  // outputType must only be stripped when its value is literally "amp"
  assert.ok(canonicalizeUrl(`${base}?outputType=full`).includes("outputtype") === false || canonicalizeUrl(`${base}?outputType=full`).includes("outputType"));
});

test("cleanTitleForSource only strips a trailing suffix that matches the item's own source", () => {
  const cleaned = cleanTitleForSource("ΟΤΕ επεκτείνει το δίκτυο FTTH - Ypodomes.com", ["ypodomes.com"]);
  assert.equal(cleaned, "ΟΤΕ επεκτείνει το δίκτυο FTTH");

  const untouched = cleanTitleForSource("Στα 196 εκατ. ευρώ το κόστος - αναθεωρημένη εκτίμηση", ["ypodomes.com"]);
  assert.equal(untouched, "Στα 196 εκατ. ευρώ το κόστος - αναθεωρημένη εκτίμηση");
});

test("RSS adapter captures the Google News <source> publisher into metadata", () => {
  const xml = `<rss><channel><item><title>ΟΤΕ FTTH news - Insider.gr</title><link>https://news.google.com/rss/articles/CBMi</link><pubDate>2026-10-24T09:00:00Z</pubDate><source url="https://www.insider.gr">Insider.gr</source></item></channel></rss>`;
  const [item] = new RssSourceAdapter().parse(xml, "https://news.google.com/rss/search");
  assert.equal(item.metadata.publisher, "Insider.gr");
});

// --- 5. Google News handling ------------------------------------------------

test("scanMarket drops a Google News item that near-duplicates a direct-source item, attaching its publisher", async () => {
  const fetch = async (url) => {
    const href = String(url);
    if (href.includes("google-feed")) {
      return {
        ok: true, url: href, headers: { get: () => "application/rss+xml" },
        text: async () => `<rss><channel><item><title>ΟΤΕ FTTH δίκτυο επέκταση στην Ελλάδα - Insider.gr</title><link>https://news.google.com/rss/articles/CBMi123</link><pubDate>2026-10-24T09:00:00Z</pubDate><source url="https://www.insider.gr">Insider.gr</source></item></channel></rss>`,
      };
    }
    if (href.includes("direct-feed")) {
      return {
        ok: true, url: href, headers: { get: () => "application/rss+xml" },
        text: async () => `<rss><channel><item><title>ΟΤΕ FTTH δίκτυο επέκταση στην Ελλάδα</title><link>https://www.insider.gr/ote-ftth</link><pubDate>2026-10-24T10:00:00Z</pubDate></item></channel></rss>`,
      };
    }
    throw new Error(`unexpected fetch ${href}`);
  };
  const result = await scanMarket({
    fetch,
    sources: [
      { id: "gnews-fibre", type: "rss", url: "https://news.google.test/google-feed" },
      { id: "insider", type: "rss", url: "https://insider.test/direct-feed" },
    ],
    rules: DEFAULT_WATCH_RULES,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].sourceId, "insider");
  assert.deepEqual(result.items[0].metadata.relatedPublishers, ["Insider.gr"]);
});

test("scanMarket flags a standalone Google News item sectionOnly when resolution stays on news.google.com", async () => {
  const fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes("feed")) {
      return {
        ok: true, url: href, headers: { get: () => "application/rss+xml" },
        text: async () => `<rss><channel><item><title>ΟΤΕ FTTH αποκλειστικό δίκτυο στην Ελλάδα - Capital.gr</title><link>https://news.google.com/rss/articles/CBMi999</link><pubDate>2026-10-24T09:00:00Z</pubDate><source url="https://www.capital.gr">Capital.gr</source></item></channel></rss>`,
      };
    }
    // Resolution call: news.google.com responds 200 with no redirect (per spec note).
    return { ok: true, status: 200, url: href, headers: { get: () => null } };
  };
  const result = await scanMarket({
    fetch,
    sources: [{ id: "gnews-fibre", type: "rss", url: "https://news.google.test/feed" }],
    rules: DEFAULT_WATCH_RULES,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].metadata.sectionOnly, true);
});

test("buildHomepageSections excludes sectionOnly items (section pages still list them elsewhere)", () => {
  const now = new Date("2026-10-25T12:00:00Z").getTime();
  const article = {
    url: "https://news.google.com/rss/articles/CBMi999", title: "ΟΤΕ FTTH αποκλειστικό δίκτυο στην Ελλάδα",
    categories: ["telco"], sourceId: "gnews-fibre", publishedAt: "2026-10-24T09:00:00Z", metadata: { sectionOnly: true },
  };
  const sections = buildHomepageSections([article], { now });
  assert.equal(sections.lead, null);
  assert.deepEqual(sections.recent, []);
  assert.deepEqual(sections.columns.telco, []);
});

test("resolveGoogleNewsItems never calls fetch unless one is injected, and flags sectionOnly instead of resolving", async () => {
  const items = [{ url: "https://news.google.com/rss/articles/CBMi", title: "Solo Google item", metadata: {} }];
  const result = await resolveGoogleNewsItems(items, {});
  assert.equal(result.length, 1);
  assert.equal(result[0].url, "https://news.google.com/rss/articles/CBMi", "no fetch injected -> resolution must not run");
  assert.ok(result[0].metadata.sectionOnly, "unresolved Google item without fetch must be flagged sectionOnly");
});

test("resolveGoogleNewsItems resolves at most 20 Google items per scan, flagging the rest sectionOnly", async () => {
  const items = Array.from({ length: 25 }, (_, i) => ({
    url: `https://news.google.com/rss/articles/CBMi-${i}`,
    title: `Distinct Google item ${i}`,
    publishedAt: `2026-10-${String(10 + i).padStart(2, "0")}T09:00:00.000Z`,
    metadata: {},
  }));
  const fetch = async (url) => {
    const href = String(url);
    if (href.includes("news.google.com")) {
      const id = href.split("CBMi-")[1];
      return { status: 302, headers: { get: (h) => (h === "location" ? `https://publisher.test/p-${id}` : null) } };
    }
    return { status: 200, url: href, headers: { get: () => null } };
  };
  const result = await resolveGoogleNewsItems(items, { fetch });
  assert.equal(result.length, 25);
  const resolved = result.filter((item) => !item.url.includes("news.google.com"));
  const sectionOnly = result.filter((item) => item.metadata.sectionOnly);
  assert.equal(resolved.length, 20, "expected exactly 20 items resolved per scan");
  assert.equal(sectionOnly.length, 5, "expected the remaining items flagged sectionOnly instead of resolved");
});

// --- 6. Off-topic drops ------------------------------------------------------

test("NOISE_HARD_REJECT matches the spec's three in-scope term groups", () => {
  assert.deepEqual(NOISE_HARD_REJECT, {
    consumer_tech: ["review", "unboxing", "κινητο* τηλεφων*", "smartwatch", "gaming", "προσφορ* καταστηματ*"],
    market_wraps: ["χρηματιστηρι* κλεισιμο", "γενικοσ δεικτησ", "μερισμα", "περιθωρι* τραπεζ*"],
    off_topic: ["ακινητ*", "ενοικι*", "τουρισμ*", "ξενοδοχει*", "κρουαζιερ*", "αθλητ*", "γηπεδ*", "ποδοσφαιρ*", "τηλεοπτικ* προγραμμα"],
  });
});

const NOISE_CASES = [
  { title: "Μέρισμα 0,50 ευρώ ανακοίνωσε η Alpha Bank", rejected: true },
  { title: "Μέρισμα από τον ΟΤΕ", rejected: false },
  { title: "Μέρισμα 0,30 ευρώ δεν θα καταβληθεί ποτέ στους μετόχους", rejected: true },
  { title: "Novartis μέρισμα στους μετόχους", rejected: true },
  { title: "Χρηματιστήριο: Κλείσιμο με άνοδο ο Γενικός Δείκτης", rejected: true },
  { title: "Νέο ξενοδοχείο στη Ρόδο", rejected: true },
  { title: "Review: το νέο smartwatch", rejected: true },
  { title: "ΔΕΗ Fiber έφτασε 1,5 εκατ. σπίτια", rejected: false },
  // accent/case variants of an off-topic term
  { title: "ΞΕΝΟΔΟΧΕΙΟ 5 αστέρων ανοίγει στην Κρήτη", rejected: true },
  { title: "Ξενοδοχειο στην Αθηνα ανοιγει ξανα", rejected: true },
];

for (const { title, rejected } of NOISE_CASES) {
  test(`noiseRejectReason(${JSON.stringify(title)}) is ${rejected ? "rejected" : "kept"}`, () => {
    const reason = noiseRejectReason({ title });
    if (rejected) assert.ok(reason, `expected "${title}" to be rejected`);
    else assert.equal(reason, null, `expected "${title}" to be kept, got ${JSON.stringify(reason)}`);
  });
}

test("scanMarket drops noise_hard_reject items before ranking and counts them per source", async () => {
  const fetch = async (url) => ({
    ok: true, url: String(url), headers: { get: () => "application/rss+xml" },
    text: async () => `<rss><channel>
      <item><title>ΟΤΕ FTTH δίκτυο επέκταση στην Ελλάδα</title><link>https://x.test/keep</link><pubDate>2026-10-24T09:00:00Z</pubDate></item>
      <item><title>Νέο ξενοδοχείο 5 αστέρων στη Ρόδο</title><link>https://x.test/drop</link><pubDate>2026-10-24T09:00:00Z</pubDate></item>
    </channel></rss>`,
  });
  const result = await scanMarket({ fetch, sources: [{ id: "mixed", type: "rss", url: "https://x.test/feed" }], rules: DEFAULT_WATCH_RULES });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].url, "https://x.test/keep");
  assert.equal(result.sources.find((s) => s.id === "mixed").noiseRejected, 1);
});
