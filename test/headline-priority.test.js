import test from "node:test";
import assert from "node:assert/strict";
import { CURATED_SCORE, storeCuratedItems, validateCuratedBatch, validateCuratedItem } from "../src/curated.js";
import { handleCuratedRequest } from "../src/curated-handler.js";
import { buildHomepageSections, headlinesFirst, isActiveHeadline, selectArticles, selectHomepageInputs } from "../src/public-data.js";
import { HOMEPAGE_MAX_ITEMS } from "../src/feed-rules.js";
import { getPublicCopy } from "../src/landing/public-copy.js";

const NOW = Date.parse("2026-10-30T12:00:00+02:00");
const HOUR = 3_600_000;
const SECRET = "test-secret-0123456789-abcdef";

const OTE = {
  title_el: "Όμιλος ΟΤΕ: Αύξηση 3,1% στα έσοδα και 5,5% στα λειτουργικά κέρδη στο εννεάμηνο",
  summary_el: "Ο όμιλος ΟΤΕ ανακοίνωσε αποτελέσματα εννεαμήνου με αύξηση εσόδων και κερδών, με επενδύσεις σε FTTH και 5G.",
  url: "https://www.example-ote.gr/ote-q3-results/",
  source: "ote-news",
  published_at: "2026-10-30T08:00:00+02:00",
  section: "telecom-fibre",
};

function fakeSql() {
  const articles = new Map();
  const sql = async (strings, ...values) => {
    const text = strings.join("?");
    if (/INSERT INTO articles/.test(text)) {
      const [url, , , , , , , , , , sourceKind, priority] = values;
      if (articles.has(url)) return [];
      const id = `id-${articles.size + 1}`;
      articles.set(url, { id, source_kind: sourceKind, priority });
      return [{ id }];
    }
    if (/UPDATE articles SET priority/.test(text)) {
      assert.match(text, /WHERE canonical_url = \?/);
      const [priority, url, again] = values;
      const row = articles.get(url);
      if (!row || row.priority === again) return [];
      row.priority = priority;
      return [{ id: row.id }];
    }
    if (/INSERT INTO article_organizations/.test(text)) return [];
    throw new Error(`unexpected statement: ${text}`);
  };
  return { sql, articles };
}
const post = (body) => new Request("https://example.test/api/curated", {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` }, body: JSON.stringify(body),
});
const deps = (db, state) => ({ env: { CURATED_INGEST_SECRET: SECRET }, now: NOW, getSql: async () => db.sql, revalidate: () => { state.revalidated += 1; } });

test("priority: only \"headline\" is kept; any other value is ignored (null), never a rejection", () => {
  assert.equal(validateCuratedItem({ ...OTE, priority: "headline" }, { now: NOW }).item.priority, "headline");
  for (const priority of ["urgent", "HEADLINE", "", 1, true, null, ["headline"], { a: 1 }, undefined]) {
    const result = validateCuratedItem({ ...OTE, priority }, { now: NOW });
    assert.equal(result.reason, undefined, String(priority));
    assert.equal(result.item.priority, null, String(priority));
  }
  assert.equal(validateCuratedBatch([{ ...OTE, priority: "headline" }], { now: NOW }).items[0].priority, "headline");
});

test("store: priority is written on insert; absent means NULL; existing rows are not touched by an unflagged re-send", async () => {
  const db = fakeSql();
  const flagged = validateCuratedBatch([{ ...OTE, priority: "headline" }], { now: NOW }).items;
  const plain = validateCuratedBatch([{ ...OTE, url: "https://www.example-ote.gr/other/" }], { now: NOW }).items;
  assert.deepEqual(await storeCuratedItems(db.sql, [...flagged, ...plain]), { inserted: 2, duplicates: 0, upgraded: 0 });
  assert.equal(db.articles.get("https://www.example-ote.gr/ote-q3-results/").priority, "headline");
  assert.equal(db.articles.get("https://www.example-ote.gr/other/").priority, null);
  // re-send without the flag: no downgrade
  const again = validateCuratedBatch([{ ...OTE }], { now: NOW }).items;
  assert.deepEqual(await storeCuratedItems(db.sql, again), { inserted: 0, duplicates: 1, upgraded: 0 });
  assert.equal(db.articles.get("https://www.example-ote.gr/ote-q3-results/").priority, "headline");
});

test("endpoint: re-sending an existing story with priority headline upgrades it once, and rebuilds the pages", async () => {
  const db = fakeSql();
  const state = { revalidated: 0 };
  await handleCuratedRequest(post([OTE]), deps(db, state));
  assert.equal(state.revalidated, 1);
  assert.equal(db.articles.get(OTE.url).priority, null);
  const upgrade = await handleCuratedRequest(post([{ ...OTE, priority: "headline" }]), deps(db, state));
  assert.deepEqual(await upgrade.json(), { ok: true, inserted: 0, duplicates: 1, upgraded: 1, rejected: [] });
  assert.equal(db.articles.get(OTE.url).priority, "headline");
  assert.equal(state.revalidated, 2);
  const third = await handleCuratedRequest(post([{ ...OTE, priority: "headline" }]), deps(db, state));
  assert.deepEqual(await third.json(), { ok: true, inserted: 0, duplicates: 1, upgraded: 0, rejected: [] });
  assert.equal(state.revalidated, 2, "already a headline: nothing to rebuild");
});

// ---- read side ---------------------------------------------------------------------------------

function row(id, title, { hoursAgo = 2, categories = ["telco"], priority, curated = true, source = `src-${id}`, score = CURATED_SCORE } = {}) {
  return {
    id, title, summary: "", canonical_url: `https://news${id}.gr/a${id}`, source_id: curated ? `curated:${source}` : source,
    published_at: new Date(NOW - hoursAgo * HOUR).toISOString(), categories, score, relevance: [],
    metadata: curated ? { sourceKind: "curated", tier: 1, publisher: source } : {},
    ...(curated ? { source_kind: "curated" } : {}),
    ...(priority ? { priority } : {}),
  };
}
const TITLES = [
  "Η Cosmote επεκτείνει το δίκτυο FTTH σε 200.000 νέα σπίτια",
  "Η Nova ενεργοποιεί 5G στο 93% του πληθυσμού",
  "Η ΕΕΤΤ δημοπρατεί φάσμα 5G για κινητή τηλεφωνία",
  "Ο ΟΤΕ ολοκληρώνει την επέκταση του FTTH στην Κρήτη",
];
const OTE_TITLE = "Όμιλος ΟΤΕ: Αύξηση 3,1% στα έσοδα και 5,5% στα λειτουργικά κέρδη";
const baseRows = () => TITLES.map((t, i) => row(`t${i}`, t, { hoursAgo: 1 + i }));
const home = (rows) => {
  const { articles, sections } = selectHomepageInputs(rows, { now: NOW });
  return buildHomepageSections(articles, { now: NOW, sections });
};
const placed = (h) => [h.lead, ...h.recent, ...Object.values(h.columns).flat()].filter(Boolean).map((a) => a.id);

test("isActiveHeadline: 48h from publication, only for priority headline", () => {
  assert.equal(isActiveHeadline({ priority: "headline", published_at: new Date(NOW - 47 * HOUR).toISOString() }, NOW), true);
  assert.equal(isActiveHeadline({ priority: "headline", publishedAt: new Date(NOW - 49 * HOUR).toISOString() }, NOW), false);
  assert.equal(isActiveHeadline({ priority: "other", published_at: new Date(NOW).toISOString() }, NOW), false);
  assert.equal(isActiveHeadline({ published_at: new Date(NOW).toISOString() }, NOW), false);
  assert.equal(isActiveHeadline({ priority: "headline" }, NOW), false);
});

test("section page: an active headline is pinned first and flagged, the rest keep date order; after 48h normal order", () => {
  const rows = [...baseRows(), row("h1", OTE_TITLE, { hoursAgo: 30, priority: "headline" })];
  const list = selectArticles(rows, { category: "telco", now: NOW, limit: 100 });
  assert.deepEqual(list.map((a) => a.id), ["h1", "t0", "t1", "t2", "t3"]);
  assert.equal(list[0].headline, true);
  assert.ok(list.slice(1).every((a) => !a.headline));
  const expired = selectArticles([...baseRows(), row("h1", OTE_TITLE, { hoursAgo: 60, priority: "headline" })], { category: "telco", now: NOW, limit: 100 });
  assert.deepEqual(expired.map((a) => a.id), ["t0", "t1", "t2", "t3", "h1"]);
  assert.ok(expired.every((a) => !a.headline));
});

test("section page: several headlines are pinned newest first, and the limit never cuts a headline", () => {
  const rows = [...baseRows(), row("h1", OTE_TITLE, { hoursAgo: 40, priority: "headline" }),
    row("h2", "Η Vodafone ανακοινώνει επενδύσεις 300 εκατ. στο δίκτυο 5G", { hoursAgo: 10, priority: "headline" })];
  assert.deepEqual(selectArticles(rows, { category: "telco", now: NOW, limit: 100 }).map((a) => a.id).slice(0, 3), ["h2", "h1", "t0"]);
  assert.deepEqual(selectArticles(rows, { category: "telco", now: NOW, limit: 2 }).map((a) => a.id), ["h2", "h1"]);
});

test("homepage: an active headline takes the lead over the normal lead pick; newest headline wins; after 48h it does not", () => {
  const withHeadline = home([...baseRows(), row("h1", OTE_TITLE, { hoursAgo: 30, priority: "headline" })]);
  assert.equal(withHeadline.lead.id, "h1");
  const baseline = home(baseRows());
  assert.notEqual(baseline.lead.id, "h1");
  const two = home([...baseRows(), row("h1", OTE_TITLE, { hoursAgo: 30, priority: "headline" }),
    row("h2", "Η Vodafone ανακοινώνει επενδύσεις 300 εκατ. στο δίκτυο 5G", { hoursAgo: 20, priority: "headline" })]);
  assert.equal(two.lead.id, "h2");
  assert.equal(two.columns.telco[0].id, "h1", "the other headline goes first in its section column");
  const expired = home([...baseRows(), row("h1", OTE_TITLE, { hoursAgo: 60, priority: "headline" })]);
  assert.notEqual(expired.lead?.id, "h1");
  assert.equal(expired.lead.id, baseline.lead.id);
});

test("homepage: each article is placed once and the total cap holds with headlines present", () => {
  const rows = [...baseRows(),
    ...Array.from({ length: 30 }, (_, i) => row(`x${i}`, `Η Cosmote επεκτείνει το δίκτυο FTTH στην περιοχή ${i + 1} με 5G`, { hoursAgo: 1 + (i % 40), curated: false, source: `s${i}`, score: 30 })),
    row("h1", OTE_TITLE, { hoursAgo: 30, priority: "headline" })];
  const h = home(rows);
  const ids = placed(h);
  assert.equal(new Set(ids).size, ids.length, "each article once");
  assert.ok(ids.length <= HOMEPAGE_MAX_ITEMS);
  assert.equal(h.lead.id, "h1");
  assert.ok(!h.columns.telco.some((a) => a.id === "h1"), "the lead is not repeated in its column");
});

test("headlinesFirst keeps order when there is no active headline", () => {
  const list = [{ id: 1 }, { id: 2 }];
  assert.equal(headlinesFirst(list, NOW), list);
});

test("copy: the Headline label exists in Greek and English", () => {
  assert.equal(getPublicCopy("el").headlineLabel, "Κύρια είδηση");
  assert.equal(getPublicCopy("en").headlineLabel, "Headline");
});
