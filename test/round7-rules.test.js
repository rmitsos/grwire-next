import test from "node:test";
import assert from "node:assert/strict";
import { noiseRejectReason, isStockMarketPiece } from "../src/feed-rules.js";
import { selectArticles } from "../src/public-data.js";

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
