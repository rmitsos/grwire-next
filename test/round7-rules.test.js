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
