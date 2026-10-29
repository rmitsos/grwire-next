import test from "node:test";
import assert from "node:assert/strict";
import { noiseRejectReason, isStockMarketPiece, isBankPromo, hasTelecomNetworkAngle } from "../src/feed-rules.js";
import { selectArticles } from "../src/public-data.js";
import { cleanSummaryText, readFeedSummary } from "../src/public-links.js";
import { scanMarket } from "../src/pipeline.js";
import { DEFAULT_WATCH_RULES } from "../src/watch-rules.js";
import { SOURCES } from "../config/sources.js";

// Real headlines from review/live-check-2026-10-29.md and the 29 Oct ot.gr / naftemporiki pages.

test("go-live stock market: Χρηματιστήριο / ΧΑ openers, ot.gr and naftemporiki market paths are dropped", () => {
  for (const title of [
    "Χρηματιστήριο – ΓΕΚ ΤΕΡΝΑ: Επιστροφή με… στιλ άνω των 40 ευρώ",
    "Χρηματιστήριο: Συνεχίζονται τα καλά νέα για τη Metlen",
    "Χρηματιστήριο Αθηνών: Άνοδος στο κλείσιμο",
    "ΧΑ: Άνοδος 1,2% με τράπεζες και ΔΕΗ",
    "ΧΑ – Κλείσιμο με ρεκόρ έτους",
    "Αντίδραση λίγων στο ΧΑ… αλλά συνωστισμός στην IPO",
  ]) assert.equal(isStockMarketPiece({ title }), true, title);
  for (const url of [
    "https://www.ot.gr/xrimatistirio/2026/10/28/x/",
    "https://www.capital.gr/xrimatistirio/3912345/metlen/",
    "https://www.naftemporiki.gr/finance/markets/1881234/gek-terna/",
  ]) assert.equal(isStockMarketPiece({ title: "Metlen: νέα", url }), true, url);
});

test("go-live stock market: company deal and exchange-in-passing stories stay", () => {
  for (const [title, url] of [
    ["ΓΕΚ ΤΕΡΝΑ: Μαγνήτης διεθνών κεφαλαίων 5,3 δισ. για την εταιρεία", "https://www.ot.gr/2026/10/27/gek-terna/"],
    ["Η ΔΕΗ ανακοίνωσε εισαγωγή του ομολόγου στο ΧΑ", "https://www.ot.gr/2026/10/27/dei/"],
    ["Το Χρηματιστήριο Αθηνών εγκρίνει την εισαγωγή νέου ομολόγου του ΑΔΜΗΕ", "https://www.ot.gr/2026/10/27/admie/"],
    ["Νέα ΧΑΡΤΑ ενέργειας από το ΥΠΕΝ", "https://www.ypodomes.com/x"],
  ]) assert.equal(noiseRejectReason({ title, url }), null, title);
});

test("go-live promos: bank retail promotions and the Project Continuum advertorial are dropped, bank project finance stays", () => {
  assert.equal(noiseRejectReason({ title: "Τράπεζα Πειραιώς: Νέο στεγαστικό με επιτόκιο 3%" })?.group, "bank_promo");
  assert.equal(isBankPromo({ title: "Eurobank: Προσφορά για επιχειρηματικά δάνεια" }), true);
  assert.equal(noiseRejectReason({ title: "Project Continuum: Νέα ενεργειακή τεχνολογία ανοίγει διαφορετικό δρόμο στην παραγωγή ηλεκτρικής ενέργειας", url: "https://www.energypress.gr/news/x" })?.group, "advertorial_blocklist");
  assert.equal(noiseRejectReason({ title: "Η Eurobank χρηματοδοτεί το έργο διασύνδεσης της ΑΔΜΗΕ με δάνειο 200 εκατ.", url: "https://x.gr/a" }), null);
  assert.equal(noiseRejectReason({ title: "Πειραιώς: Συμμετοχή στο πρόγραμμα ΣΔΙΤ για τον ΒΟΑΚ", url: "https://x.gr/b" }), null);
});

test("go-live summaries: [&hellip;], […], the Naftemporiki suffix and a repeated title are cleaned", () => {
  assert.equal(cleanSummaryText("Ο Γ. Περιστέρης αγόρασε μετοχές [&hellip;] - Η ΝΑΥΤΕΜΠΟΡΙΚΗ", { title: "Άλλος τίτλος", publishers: ["Η ΝΑΥΤΕΜΠΟΡΙΚΗ"] }), "Ο Γ. Περιστέρης αγόρασε μετοχές");
  assert.equal(cleanSummaryText("Το κείμενο συνεχίζεται […]", { title: "Τίτλος" }), "Το κείμενο συνεχίζεται");
  const title = "Παληαρούτα: Τις επόμενες ημέρες οι λίστες προτεραιότητας για τις merchant μπαταρίες";
  assert.doesNotMatch(cleanSummaryText(`${title} 07:30`, { title }) || "", /Παληαρούτα/);
  assert.equal(readFeedSummary(title, title).summary, null, "a summary that only repeats the title is dropped");
});

test("go-live /telco: data-centre and AI headlines have no network angle, network headlines do", () => {
  for (const title of [
    "Ναι με αστερίσκους για το νέο πλαίσιο των data centers",
    "Η Ελληνίδα του MIT που φέρνει τον τεχνητό νου στις επιχειρήσεις",
    "Τέρνα Ενεργειακή: Νέο data center στη Βοιωτία",
  ]) assert.equal(hasTelecomNetworkAngle(title), false, title);
  for (const title of ["Η Cosmote επεκτείνει το FTTH σε 30 νέους δήμους", "Η ΕΕΤΤ ανοίγει διαβούλευση για το φάσμα 5G"]) {
    assert.equal(hasTelecomNetworkAngle(title), true, title);
  }
});

test("go-live /telco: the headline decides, a network word only in the summary no longer keeps a telco story", () => {
  const now = Date.parse("2026-10-29T08:00:00+02:00");
  const row = (id, title, summary) => ({ id, title, summary, canonical_url: `https://example.gr/${id}`, source_id: `s-${id}`,
    published_at: new Date(now - 3_600_000).toISOString(), categories: ["telco"], score: 15, relevance: [], metadata: {} });
  const rows = [
    row("dc", "Ναι με αστερίσκους για το νέο πλαίσιο των data centers", "Η Vodafone και το δίκτυο οπτικών ινών ωφελούνται."),
    row("ftth", "Η Cosmote επεκτείνει το FTTH σε νέους δήμους", ""),
  ];
  const urls = selectArticles(rows, { category: "telco", now }).map((a) => a.url);
  assert.deepEqual(urls, ["https://example.gr/ftth"]);
});

test("go-live ingest: naftemporiki-telecoms rejects undated items, dated ones pass", async () => {
  const source = SOURCES.find((s) => s.id === "naftemporiki-telecoms");
  assert.equal(source.requirePublishedAt, true);
  const feed = `<rss><channel>
    <item><title>Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους της Ελλάδας</title><link>https://n.test/dated</link><pubDate>2026-10-29T04:00:00Z</pubDate><description>FTTH οπτικές ίνες Cosmote δίκτυο Ελλάδα.</description></item>
    <item><title>Η Cosmote επεκτείνει το δίκτυο FTTH σε άλλους δήμους της Ελλάδας</title><link>https://n.test/undated</link><description>FTTH οπτικές ίνες Cosmote δίκτυο Ελλάδα.</description></item>
  </channel></rss>`;
  const fetch = async (url) => ({ ok: true, url: String(url), headers: { get: () => "application/rss+xml" }, text: async () => feed });
  const drops = [];
  const result = await scanMarket({
    fetch, rules: DEFAULT_WATCH_RULES, now: Date.parse("2026-10-29T08:00:00Z"),
    sources: [{ id: "naftemporiki-telecoms", type: "rss", url: "https://n.test/feed", requirePublishedAt: true }],
    onDrop: (item, info) => drops.push([item.url, info.stage]),
  });
  assert.deepEqual(result.items.map((i) => i.url), ["https://n.test/dated"]);
  assert.deepEqual(drops.filter(([, stage]) => stage === "undated_at_ingest"), [["https://n.test/undated", "undated_at_ingest"]]);
});
