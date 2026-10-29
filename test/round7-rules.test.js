import test from "node:test";
import assert from "node:assert/strict";
import { noiseRejectReason, isStockMarketPiece } from "../src/feed-rules.js";
import { selectArticles, selectHomepageInputs, buildHomepageSections, trimToSectionCaps } from "../src/public-data.js";
import { CATEGORY_TO_SPEC_SECTION, SECTION_HOMEPAGE_CAPS, SECTION_SHARE_MAX, HOMEPAGE_TARGET_ITEMS } from "../src/feed-rules.js";

const NOW = Date.parse("2026-10-29T08:00:00+02:00");
const HOUR = 3_600_000;

function row({ id, title, summary = "", url, source = "ot-gr", hoursAgo = 2, categories = ["deals"], score = 12, publishedAt, metadata = {} }) {
  const published = publishedAt === undefined ? new Date(NOW - hoursAgo * HOUR).toISOString() : publishedAt;
  return {
    id, title, summary, canonical_url: url || `https://example.gr/${id}`, source_id: source,
    published_at: published, categories, score, relevance: [], metadata,
  };
}

// ---- Fix 1: stock-market noise -------------------------------------------------------------

test("round-7 stock-market headlines: 'Χρηματιστήριο' + colon or dash is noise", () => {
  for (const title of [
    "Χρηματιστήριο: Συνεχίζονται τα καλά νέα για τη Metlen",
    "Χρηματιστήριο: Κάνει την ανατροπή η ΓΕΚ ΤΕΡΝΑ",
    "Χρηματιστήριο – ΓΕΚ ΤΕΡΝΑ: Επιστροφή με… στιλ άνω των 40 ευρώ",
    "Χρηματιστήριο - ΓΕΚ ΤΕΡΝΑ: Επιστροφή",
    "ΧΡΗΜΑΤΙΣΤΗΡΙΟ: ΟΤΕ σε άνοδο",
    "Χρηματιστήριο — Metlen",
    "  Χρηματιστηριο : Metlen",
  ]) {
    assert.deepEqual(noiseRejectReason({ title }), { group: "stock_market_headline", term: null }, title);
  }
});

test("round-7 stock-market URL: naftemporiki /finance/markets/ is noise, other paths are not", () => {
  const title = "ΓΕΚ ΤΕΡΝΑ: ισχυρή επιστροφή";
  assert.ok(noiseRejectReason({ title, url: "https://www.naftemporiki.gr/finance/markets/1881234/gek-terna/" }));
  assert.ok(noiseRejectReason({ title, canonical_url: "https://naftemporiki.gr/finance/markets/1881234/x/" }));
  assert.equal(noiseRejectReason({ title, url: "https://www.naftemporiki.gr/finance/economy/1881234/x/" }), null);
  assert.equal(noiseRejectReason({ title, url: "https://example.gr/finance/markets/1881234/x/" }), null);
  assert.equal(isStockMarketPiece({ title, url: "https://www.naftemporiki.gr/energy/1/x/" }), false);
});

test("round-7 genuine company deal stories are kept (not stock-market noise)", () => {
  for (const title of [
    "ΓΕΚ ΤΕΡΝΑ: Μαγνήτης διεθνών κεφαλαίων 5,3 δισ. για την εταιρεία",
    "Το Χρηματιστήριο Αθηνών εγκρίνει την εισαγωγή νέου ομολόγου του ΑΔΜΗΕ",
    "Η Metlen στο Χρηματιστήριο του Λονδίνου: νέα εισαγωγή",
  ]) {
    assert.equal(noiseRejectReason({ title, url: "https://www.ot.gr/2026/10/27/x/" }), null, title);
  }
});

test("round-7 stock-market pieces disappear at read time from stored rows (and from section pages)", () => {
  const rows = [
    row({ id: "a", title: "Χρηματιστήριο: Κάνει την ανατροπή η ΓΕΚ ΤΕΡΝΑ", url: "https://www.ot.gr/a" }),
    row({ id: "b", title: "Επιστροφή της ΓΕΚ ΤΕΡΝΑ πάνω από τα 40 ευρώ", url: "https://www.naftemporiki.gr/finance/markets/1/x/", source: "naftemporiki" }),
    row({ id: "c", title: "ΓΕΚ ΤΕΡΝΑ: Μαγνήτης διεθνών κεφαλαίων 5,3 δισ.", summary: "Η ΓΕΚ ΤΕΡΝΑ προσελκύει επενδύσεις για έργα υποδομών.", url: "https://www.ot.gr/c" }),
  ];
  const dropped = [];
  const out = selectArticles(rows, { category: "deals", now: NOW, onDrop: (r, reason) => dropped.push([r.id, reason.group]) });
  assert.deepEqual(dropped.sort(), [["a", "stock_market_headline"], ["b", "stock_market_headline"]]);
  assert.deepEqual(out.map((a) => a.url), ["https://www.ot.gr/c"]);
});

test("round-7 stock-market pieces are also rejected at scan (ingest) time", async () => {
  const { scanMarket } = await import("../src/pipeline.js");
  const { DEFAULT_WATCH_RULES } = await import("../src/watch-rules.js");
  const fetch = async (url) => ({
    ok: true, url: String(url), headers: { get: () => "application/rss+xml" },
    text: async () => `<rss><channel>
      <item><title>ΟΤΕ FTTH δίκτυο επέκταση στην Ελλάδα</title><link>https://x.test/keep</link><pubDate>Thu, 29 Oct 2026 05:00:00 GMT</pubDate></item>
      <item><title>Χρηματιστήριο – ΓΕΚ ΤΕΡΝΑ: Επιστροφή με στιλ</title><link>https://x.test/drop1</link><pubDate>Thu, 29 Oct 2026 05:00:00 GMT</pubDate></item>
      <item><title>ΓΕΚ ΤΕΡΝΑ επιστρέφει πάνω από τα 40 ευρώ</title><link>https://www.naftemporiki.gr/finance/markets/1/x/</link><pubDate>Thu, 29 Oct 2026 05:00:00 GMT</pubDate></item>
    </channel></rss>`,
  });
  const result = await scanMarket({ fetch, sources: [{ id: "mixed", type: "rss", url: "https://x.test/feed" }], rules: DEFAULT_WATCH_RULES });
  assert.deepEqual(result.items.map((item) => item.url), ["https://x.test/keep"]);
  assert.equal(result.sources.find((s) => s.id === "mixed").noiseRejected, 2);
});

// ---- Fix 3: Google News redirects on section pages -------------------------------------------

const GNEWS = "https://news.google.com/rss/articles/CBMiOpaqueEncryptedToken?oc=5";
const OTE_TITLE = "Ο ΟΤΕ επεκτείνει το δίκτυο FTTH οπτικών ινών σε νέους δήμους της Ελλάδας";

test("round-7 unresolved Google News links are dropped from section pages as well as the homepage", () => {
  const dropped = [];
  const rows = [
    row({ id: "g1", title: OTE_TITLE, url: GNEWS, source: "gnews-fibre", categories: ["telco"], metadata: { publisher: "Capital.gr" } }),
    row({ id: "g2", title: "Vodafone and Nova expand 5G network coverage in Greece", url: GNEWS + "2", source: "gnews-fibre", categories: ["telco"] }),
    row({ id: "ok", title: OTE_TITLE + " (2)", url: "https://www.capital.gr/ote-ftth", source: "capital", categories: ["telco"] }),
    row({ id: "res", title: "Η Nova επεκτείνει το δίκτυο 5G οπτικών ινών σε νέους δήμους", url: GNEWS + "3", source: "gnews-fibre", categories: ["telco"], metadata: { originalUrl: "https://www.insider.gr/nova-5g?utm_source=x" } }),
  ];
  const out = selectArticles(rows, { category: "telco", now: NOW, onDrop: (r, reason) => dropped.push([r.id, reason.stage]) });
  assert.ok(out.length >= 1);
  assert.ok(out.every((a) => !a.url.includes("news.google.com")), `no Google News link: ${out.map((a) => a.url)}`);
  assert.ok(out.every((a) => a.viaGoogleNews === false));
  assert.ok(out.some((a) => a.url === "https://www.insider.gr/nova-5g"), "a resolvable Google News item keeps its publisher URL");
  assert.deepEqual(dropped.filter(([, stage]) => stage === "google_news_unresolved").map(([id]) => id).sort(), ["g1", "g2"]);
});

// ---- Fix 6: undated items, water/sewage, sponsored content -----------------------------------

test("round-7 undated items are dropped (section pages, homepage selection and nav counts)", () => {
  const dropped = [];
  const rows = [
    row({ id: "u1", title: OTE_TITLE, url: "https://www.capital.gr/u1", categories: ["telco"], publishedAt: null }),
    row({ id: "u2", title: OTE_TITLE + " B", url: "https://www.capital.gr/u2", categories: ["telco"], publishedAt: "not a date" }),
    row({ id: "ok", title: OTE_TITLE + " C", url: "https://www.capital.gr/ok", categories: ["telco"] }),
  ];
  const out = selectArticles(rows, { now: NOW, onDrop: (r, reason) => dropped.push([r.id, reason.stage]) });
  assert.deepEqual(out.map((a) => a.url), ["https://www.capital.gr/ok"]);
  assert.ok(out.every((a) => a.publishedAt));
  assert.deepEqual(dropped.sort(), [["u1", "undated"], ["u2", "undated"]]);
});

test("round-7 water/sewage stories are not infrastructure news: the Mykonos port water-recycling item is dropped", () => {
  const dropped = [];
  const mykonos = row({
    id: "myk", title: "Νέο σύστημα ανακύκλωσης νερού στο λιμάνι της Μυκόνου",
    summary: "Ένα νέο σύστημα ανακύκλωσης και επαναχρησιμοποίησης νερού τέθηκε σε λειτουργία στο λιμάνι της Μυκόνου, με στόχο τη μείωση της κατανάλωσης νερού κατά περισσότερο από 65%. Το έργο χρηματοδοτήθηκε εξ ολοκλήρου από την CTL Maritime, εταιρεία του ομίλου MSC, ενισχύοντας τις περιβαλλοντικές υποδομές του λιμένα [&hellip;]",
    url: "https://ypodomes.com/mykonos-water", source: "ypodomes", categories: ["infrastructure"],
  });
  const port = row({ id: "port", title: "Παραχώρηση του λιμανιού της Αλεξανδρούπολης: νέος διαγωνισμός ΣΔΙΤ", url: "https://ypodomes.com/port", source: "ypodomes", categories: ["infrastructure"] });
  const out = selectArticles([mykonos, port], { category: "infrastructure", now: NOW, onDrop: (r, reason) => dropped.push([r.id, reason.stage]) });
  assert.deepEqual(out.map((a) => a.url), ["https://ypodomes.com/port"]);
  assert.deepEqual(dropped, [["myk", "no_category"]]);
  assert.equal(selectArticles([mykonos], { now: NOW }).length, 0, "also gone from the homepage selection");
});

test("round-7 isWaterSewageStory: water headline vs major works", async () => {
  const { isWaterSewageStory } = await import("../src/feed-rules.js");
  assert.equal(isWaterSewageStory({ title: "Έργα ύδρευσης και αποχέτευσης στη Νάξο" }), true);
  assert.equal(isWaterSewageStory({ title: "Νέος βιολογικός καθαρισμός στη Ρόδο" }), true);
  assert.equal(isWaterSewageStory({ title: "Data center με ψύξη νερού από την Digital Realty" }), false);
  assert.equal(isWaterSewageStory({ title: "Νέος αυτοκινητόδρομος Πάτρα–Πύργος" }), false);
});

test("round-7 sponsored content is dropped only on an explicit marker, never by headline alone", async () => {
  const { sponsoredReason } = await import("../src/feed-rules.js");
  const plain = { title: "Project Continuum: Νέα ενεργειακή τεχνολογία για τα δίκτυα", summary: "Η νέα τεχνολογία αποθήκευσης…", url: "https://energypress.gr/news/project-continuum" };
  assert.equal(sponsoredReason(plain), null, "headline alone is not evidence of sponsorship");
  assert.equal(sponsoredReason({ ...plain, url: "https://energypress.gr/sponsored/project-continuum" }), "url");
  assert.equal(sponsoredReason({ ...plain, url: "https://energypress.gr/news/not-an-advertorial-project/" }), null, "a marker word inside a longer slug is not a path segment");
  assert.equal(sponsoredReason({ ...plain, metadata: { sponsored: true } }), "metadata");
  assert.equal(sponsoredReason({ ...plain, metadata: { categories: ["Advertorial"] } }), "metadata");
  assert.equal(sponsoredReason({ ...plain, title: "[Sponsored] Project Continuum" }), "label");
  assert.equal(sponsoredReason({ ...plain, title: "Χορηγούμενο: Project Continuum" }), "label");
  assert.equal(sponsoredReason({ ...plain, summary: "Advertorial. Η νέα τεχνολογία" }), "label");
  assert.equal(sponsoredReason({ ...plain, summary: "Διαφημιστικό δημοσίευμα – η νέα τεχνολογία" }), "phrase");
  assert.equal(sponsoredReason({ title: "Διαφημιστική εκστρατεία της ΔΕΗ για το νέο δίκτυο" }), null);
  assert.equal(sponsoredReason({ title: "Το συνέδριο ενέργειας χρηματοδοτείται από χορηγούς, sponsored by ΑΔΜΗΕ" }), null);
  assert.deepEqual(noiseRejectReason({ ...plain, url: "https://energypress.gr/sponsored/project-continuum" }), { group: "sponsored", term: null });
  assert.equal(noiseRejectReason(plain), null);
});

// ---- Fix 4: summary cleanup -------------------------------------------------------------------

test("round-7 summaries: '[&hellip;]' / '[…]' / '[...]' markers are stripped", async () => {
  const { readFeedSummary } = await import("../src/public-links.js");
  for (const marker of ["[&hellip;]", "[…]", "[...]", "[ … ]", "[&amp;hellip;]"]) {
    const out = readFeedSummary("Τίτλος άρθρου για το δίκτυο", `Η ΡΑΑΕΥ θέτει σε διαβούλευση το πρόγραμμα ανάπτυξης ${marker}`);
    assert.equal(out.summary, "Η ΡΑΑΕΥ θέτει σε διαβούλευση το πρόγραμμα ανάπτυξης", marker);
  }
});

test("round-7 summaries: trailing ' - <Publisher>' (the Naftemporiki sitename and similar) is stripped", async () => {
  const { readFeedSummary } = await import("../src/public-links.js");
  const title = "ΓΕΚ Τέρνα: Στον σχεδιασμό ομολογιακή έκδοση 500 εκατ.";
  const out = readFeedSummary(title + " - Η ΝΑΥΤΕΜΠΟΡΙΚΗ", `Οι συναντήσεις με ειδικούς επενδυτές στις διεθνείς αγορές… ${title} - Η ΝΑΥΤΕΜΠΟΡΙΚΗ`);
  assert.equal(out.summary, "Οι συναντήσεις με ειδικούς επενδυτές στις διεθνείς αγορές…");
  assert.equal(readFeedSummary("Τίτλος", "Η συμφωνία κλείνει σήμερα - Capital.gr", { publishers: ["Capital.gr"] }).summary, "Η συμφωνία κλείνει σήμερα");
  assert.equal(readFeedSummary("Τίτλος", "Η συμφωνία κλείνει σήμερα - Η ΚΑΘΗΜΕΡΙΝΗ").summary, "Η συμφωνία κλείνει σήμερα");
  // Not a publisher: a short company name or a normal clause after a dash stays.
  assert.equal(readFeedSummary("Τίτλος", "Η σύμβαση υπογράφηκε με την κοινοπραξία - ΟΤΕ").summary, "Η σύμβαση υπογράφηκε με την κοινοπραξία - ΟΤΕ");
  assert.equal(readFeedSummary("Τίτλος", "Το έργο ξεκινά - αναμένεται να ολοκληρωθεί το 2028").summary, "Το έργο ξεκινά - αναμένεται να ολοκληρωθεί το 2028");
});

test("round-7 summaries: energypress title repetition and 'handle date | time' leftovers are removed", async () => {
  const { readFeedSummary } = await import("../src/public-links.js");
  const title = "Παληαρούτα: Τις επόμενες ημέρες οι λίστες προτεραιότητας για τις merchant μπαταρίες - Ιεραρχούμε 3 κατηγορίες έργων αποθήκευσης";
  const body = "Προτεραιότητα για να ηλεκτριστούν έχουν τα έργα αποθήκευσης τα οποία είναι ήδη σε εξέλιξη, σημείωσε η Γενική Γραμματέας Ενέργειας, μιλώντας στο...";
  const out = readFeedSummary(title, `${title} ${body} ekalogerh 28 10 2026 | 07:30`);
  assert.equal(out.summary, body);
  // Only the title and the leftover: nothing is left to show.
  assert.equal(readFeedSummary(title, `${title} ekotsifi 26 10 2026 | 15:16`).summary, null);
  // A summary that merely begins with similar words is kept.
  assert.equal(readFeedSummary("Η ΡΑΑΕΥ ανακοίνωσε νέα απόφαση", "Η ΡΑΑΕΥ ανακοίνωσε χθες νέα απόφαση για τις χρεώσεις.").summary, "Η ΡΑΑΕΥ ανακοίνωσε χθες νέα απόφαση για τις χρεώσεις.");
  // A clock time inside the body is not a leftover.
  assert.equal(readFeedSummary("Τίτλος", "Η συνεδρίαση ξεκινά στις 10:30").summary, "Η συνεδρίαση ξεκινά στις 10:30");
});

test("round-7 summaries are cleaned on the public article shape, section pages included", () => {
  const title = "ΡΑΑΕΥ: Με 83 εκατ. από τα έσοδα των διασυνδέσεων η μείωση των χρεώσεων χρήσης συστήματος";
  const rows = [row({
    id: "e1", title, url: "https://energypress.gr/news/x", source: "energypress", categories: ["energy"],
    summary: `${title} Η ΡΑΑΕΥ προχώρησε σε μείωση των χρεώσεων των διασυνδέσεων του συστήματος ηλεκτρικής ενέργειας... ekotsifi 26 10 2026 | 15:16`,
  }), row({
    id: "e2", title: "Ο ΑΔΜΗΕ προχωρά στη διασύνδεση των Κυκλάδων με νέο υποσταθμό υψηλής τάσης", url: "https://ypodomes.com/y", source: "ypodomes", categories: ["energy"],
    summary: "Ο ΑΔΜΗΕ προχωρά στη διασύνδεση των νοτίων Κυκλάδων, έργου συνολικού προϋπολογισμού [&hellip;]",
  })];
  const out = selectArticles(rows, { category: "energy", now: NOW });
  assert.ok(out.length >= 1);
  for (const article of out) {
    assert.ok(!/hellip|\[…\]|\[\.\.\.\]|\d{4}\s*\|\s*\d{1,2}:\d{2}/.test(article.summary || ""), article.summary);
  }
  assert.ok(out.find((a) => a.url === "https://energypress.gr/news/x").summary.startsWith("Η ΡΑΑΕΥ προχώρησε"));
});

// ---- Fix 2: homepage columns use the section pages' selection ------------------------------

const art = (i, categories, { hoursAgo = 3 + i * 0.1, score = 20, title } = {}) => ({
  url: `https://example.gr/a-${categories.join("-")}-${i}`,
  title: title || `Ειδηση ${categories.join("/")} αρ. ${i}`,
  summary: "", sourceId: `src-${categories.join("-")}-${i}`, categories, score,
  publishedAt: new Date(NOW - hoursAgo * HOUR).toISOString(), metadata: {},
});
const shownOf = (r) => [r.lead, ...r.recent, ...Object.values(r.columns).flat()].filter(Boolean);
const specOf = (a) => new Set((a.categories || []).map((c) => CATEGORY_TO_SPEC_SECTION[c]).filter(Boolean));

test("round-7 columns: every section with fresh items has a non-empty column, even when 'recent' could take everything", () => {
  const articles = [
    ...Array.from({ length: 6 }, (_, i) => art(i, ["energy"], { hoursAgo: 1 + i * 0.2 })),
    ...Array.from({ length: 3 }, (_, i) => art(i, ["telco"], { hoursAgo: 8 + i })),
    ...Array.from({ length: 2 }, (_, i) => art(i, ["infrastructure"], { hoursAgo: 10 + i })),
    ...Array.from({ length: 2 }, (_, i) => art(i, ["deals"], { hoursAgo: 12 + i })),
  ];
  const result = buildHomepageSections(articles, { now: NOW });
  for (const slug of ["telco", "energy", "infrastructure", "deals"]) {
    assert.ok(result.columns[slug].length >= 1, `column ${slug} must not be empty`);
    for (const a of result.columns[slug]) assert.ok(a.categories.includes(slug));
  }
  assert.equal(result.columns.regulators.length, 0, "a section with no items stays empty (nothing is padded in)");
  const urls = shownOf(result).map((a) => a.url);
  assert.equal(new Set(urls).size, urls.length, "an article appears once on the homepage");
});

test("round-7 columns come from the section-page list, in its order (`sections` option)", () => {
  const articles = Array.from({ length: 8 }, (_, i) => art(i, ["telco"], { hoursAgo: 2 + i, score: i === 0 ? 60 : i === 6 ? 40 : 20 }));
  // The section page ranks article 6 first; the column must lead with it, not with the newest.
  const result = buildHomepageSections(articles, { now: NOW, sections: { telco: [articles[6]] } });
  assert.equal(result.columns.telco[0]?.url, articles[6].url);
});

test("round-7 selectHomepageInputs: section lists equal what each section page selects from the same rows", () => {
  const rows = [
    row({ id: "t1", title: "Η Cosmote επεκτείνει το δίκτυο οπτικών ινών FTTH σε 40 πόλεις", source: "cosmote", categories: ["telco"], score: 30, hoursAgo: 2 }),
    row({ id: "e1", title: "Ο ΑΔΜΗΕ προχωρά στη διασύνδεση των Κυκλάδων με νέο υποσταθμό υψηλής τάσης", source: "ypodomes", categories: ["energy"], score: 30, hoursAgo: 3 }),
  ];
  const { articles, sections } = selectHomepageInputs(rows, { now: NOW });
  assert.deepEqual(articles.map((a) => a.url), selectArticles(rows, { limit: 100, now: NOW }).map((a) => a.url));
  for (const slug of ["telco", "energy", "infrastructure", "deals", "tenders", "regulators"]) {
    assert.deepEqual(sections[slug].map((a) => a.url), selectArticles(rows, { category: slug, limit: 100, now: NOW }).map((a) => a.url), slug);
  }
});

// ---- Fix 5: section caps hold on the FINAL homepage list ----------------------------------

const countBySection = (list) => {
  const counts = {};
  for (const a of list) for (const s of specOf(a)) counts[s] = (counts[s] || 0) + 1;
  return counts;
};

test("round-7 caps: no section exceeds its homepage cap or the 35% share on the final list", () => {
  const articles = [
    ...Array.from({ length: 8 }, (_, i) => art(i, ["energy"], { hoursAgo: 1 + i * 0.3, score: 25 - i })),
    ...Array.from({ length: 5 }, (_, i) => art(i, ["deals"], { hoursAgo: 2 + i * 0.3, score: 24 - i })),
    ...Array.from({ length: 4 }, (_, i) => art(i, ["telco"], { hoursAgo: 4 + i * 0.3, score: 20 - i })),
    ...Array.from({ length: 4 }, (_, i) => art(i, ["infrastructure"], { hoursAgo: 5 + i * 0.3, score: 19 - i })),
  ];
  const list = shownOf(buildHomepageSections(articles, { now: NOW }));
  const total = list.length;
  const shareCap = Math.floor(SECTION_SHARE_MAX * Math.max(total, HOMEPAGE_TARGET_ITEMS));
  for (const [section, count] of Object.entries(countBySection(list))) {
    assert.ok(count <= Math.min(SECTION_HOMEPAGE_CAPS[section], shareCap), `${section}: ${count} of ${total}`);
  }
});

test("round-7 caps: a multi-tag story counts ONCE, under its primary section (first category), never per tag", () => {
  const primaryOf = (a) => CATEGORY_TO_SPEC_SECTION[a.categories[0]];
  const tower = (i) => art(i, ["telco", "deals", "energy"], { hoursAgo: 1 + i * 0.2, score: 30 });
  const articles = [
    ...Array.from({ length: 3 }, (_, i) => tower(i)),
    ...Array.from({ length: 2 }, (_, i) => art(i, ["deals"], { hoursAgo: 3 + i, score: 22 })),
    ...Array.from({ length: 3 }, (_, i) => art(i, ["energy"], { hoursAgo: 5 + i, score: 20 })),
    ...Array.from({ length: 3 }, (_, i) => art(i, ["infrastructure"], { hoursAgo: 9 + i, score: 17 })),
  ];
  const list = shownOf(buildHomepageSections(articles, { now: NOW }));
  for (const [section, cap] of Object.entries(SECTION_HOMEPAGE_CAPS)) {
    const n = list.filter((a) => primaryOf(a) === section).length;
    assert.ok(n <= cap, `${section}: ${n} > ${cap}`);
  }
  // The three telco-primary stories keep their place although they also carry the deals and energy tags.
  assert.equal(list.filter((a) => primaryOf(a) === "telecom-fibre" && a.categories.length === 3).length, 3);
});

test("round-7 caps: trimToSectionCaps leaves a section alone when its extra tags are the only overlap", () => {
  const lead = art(0, ["energy"], { score: 50 });
  const tagged = Array.from({ length: 3 }, (_, i) => art(i, ["telco", "energy"], { score: 20 - i }));
  const energy = Array.from({ length: 2 }, (_, i) => art(i + 10, ["energy"], { score: 15 - i }));
  const dropped = [];
  const out = trimToSectionCaps({ lead, recent: [...tagged, ...energy, art(0, ["infrastructure"])], columns: {} }, { onDrop: (a) => dropped.push(a) });
  // energy-primary: lead + 2 = 3 (cap 3); the three telco-primary stories are not counted against energy.
  assert.deepEqual(dropped, []);
  assert.equal(out.recent.length, 6);
});

test("round-7 caps: primary-section overflow is still trimmed (4 energy-primary stories out of 9 -> 3)", () => {
  const lead = art(0, ["energy"], { score: 50 });
  const energy = Array.from({ length: 3 }, (_, i) => art(i + 1, ["energy", "telco"], { score: 20 - i }));
  const others = [art(0, ["telco"]), art(1, ["telco"]), art(0, ["infrastructure"]), art(1, ["infrastructure"]), art(0, ["regulators"])];
  const out = trimToSectionCaps({ lead, recent: [...energy, ...others], columns: {} });
  assert.equal(out.trimmed.length, 1);
  assert.equal(out.trimmed[0], energy[2]);
});

test("round-7 caps: the reviewer's case — 4 energy stories in a list of 9 is trimmed to 3 (33%) and the lead survives", () => {
  const lead = art(0, ["energy"], { score: 50 });
  const energy = Array.from({ length: 3 }, (_, i) => art(i + 1, ["energy"], { score: 20 - i }));
  const others = [
    art(0, ["telco"]), art(1, ["telco"]), art(0, ["infrastructure"]), art(1, ["infrastructure"]), art(0, ["regulators"]),
  ];
  const input = { lead, recent: [...energy, ...others], columns: {} };
  const dropped = [];
  const out = trimToSectionCaps(input, { onDrop: (a, reason) => dropped.push([a, reason]) });
  assert.equal(out.lead, lead);
  const all = [out.lead, ...out.recent].filter(Boolean);
  assert.equal(all.filter((a) => a.categories.includes("energy")).length, 3);
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0][0], energy[2], "the lowest-scoring energy story goes");
  assert.equal(dropped[0][1].stage, "section_cap_final");
});

test("round-7 caps: trimming does not pad — slots freed by the cap stay empty unless backfill qualifies", () => {
  const articles = Array.from({ length: 6 }, (_, i) => art(i, ["energy"], { hoursAgo: 1 + i * 0.3, score: 25 - i }));
  const list = shownOf(buildHomepageSections(articles, { now: NOW }));
  assert.ok(list.length <= SECTION_HOMEPAGE_CAPS["energy-grids"], `list ${list.length}`);
  assert.ok(list.length >= 1);
});

// ---- Fix 7: sitemap and robots ---------------------------------------------------------------

test("round-7 robots.txt advertises the sitemap and keeps its disallow rules", async () => {
  const robots = (await import("../src/app/robots.js")).default();
  assert.equal(robots.sitemap, "https://www.grwire.com/sitemap.xml");
  assert.deepEqual(robots.rules.disallow, ["/intelligence", "/api", "/search?", "/en/search?"]);
});

test("round-7 sitemap lists /regulators and /en/regulators once the section has >=3 items in 30 days, and drops them below that", async () => {
  const { buildPublicSitemapEntries } = await import("../src/app/sitemap.js");
  const { computeNavVisibility } = await import("../src/public-data.js");
  const reg = (i) => ({ url: `https://example.gr/r${i}`, categories: ["regulators"], publishedAt: new Date(NOW - (2 + i * 6) * 24 * HOUR).toISOString() });
  const base = "https://www.grwire.com";
  const urls = (articles) => buildPublicSitemapEntries(base, computeNavVisibility(articles, { now: NOW })).map((e) => e.url);

  const three = urls([reg(0), reg(1), reg(2)]);
  assert.ok(three.includes(`${base}/regulators`));
  assert.ok(three.includes(`${base}/en/regulators`));
  const two = urls([reg(0), reg(1)]);
  assert.ok(!two.includes(`${base}/regulators`));
  assert.ok(!two.includes(`${base}/en/regulators`));
  // The visible sections are still there.
  for (const path of ["/", "/en", "/telco", "/energy", "/infrastructure", "/deals"]) {
    assert.ok(three.includes(`${base}${path === "/" ? "/" : path}`), path);
  }
});

test("round-7 sitemap is revalidated (not frozen at build time), so the >=3 rule stays dynamic", async () => {
  const mod = await import("../src/app/sitemap.js");
  assert.equal(mod.revalidate, 3600);
});

test("round-7 caps: an over-cap section loses its older backfill story before a fresh one, whatever the scores", () => {
  const lead = art(0, ["energy"], { score: 50 });
  const fresh = [art(1, ["energy"], { score: 8 }), art(2, ["energy"], { score: 9 })];
  const backfill = { ...art(3, ["energy"], { hoursAgo: 24 * 9, score: 30 }), homepageBackfill: true };
  const others = [art(0, ["telco"]), art(1, ["telco"]), art(0, ["infrastructure"]), art(1, ["infrastructure"]), art(0, ["regulators"])];
  const dropped = [];
  trimToSectionCaps({ lead, recent: [...fresh, backfill, ...others], columns: {} }, { onDrop: (a) => dropped.push(a) });
  assert.deepEqual(dropped, [backfill]);
});
