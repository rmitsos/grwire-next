import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CURATED_MAX_ITEMS, CURATED_SCORE, curatedUrlProblem, isCuratedAuthorised, storeCuratedItems,
  validateCuratedBatch, validateCuratedItem,
} from "../src/curated.js";
import { handleCuratedRequest } from "../src/curated-handler.js";
import { buildHomepageSections, selectArticles, selectHomepageInputs } from "../src/public-data.js";
import { SECTION_HOMEPAGE_CAPS } from "../src/feed-rules.js";

const NOW = Date.parse("2026-10-29T15:00:00+02:00");
const HOUR = 3_600_000;
const SECRET = "test-secret-0123456789-abcdef";

const good = (over = {}) => ({
  title_el: "Η Telekom λανσάρει το Fiber Router 7 και την υπηρεσία Power WiFi",
  summary_el: "Νέος router Wi-Fi 7 δωρεάν με συνδέσεις FTTH και υπηρεσία mesh για κάλυψη σε όλο το σπίτι.",
  url: "https://www.xblog.gr/i-telekom-lansarei-fiber-router-7/",
  source: "xblog",
  published_at: "2026-10-28T16:32:01+02:00",
  section: "telecom-fibre",
  ...over,
});

// ---- fake database: understands exactly the statements storeCuratedItems issues ---------------
function fakeSql() {
  const articles = new Map();
  const links = [];
  const calls = [];
  const sql = async (strings, ...values) => {
    const text = strings.join("?");
    calls.push({ text, values });
    if (/INSERT INTO articles/.test(text)) {
      const [url, title, summary, publishedAt, sourceId, sourceUrl, score, categories, relevance, metadata, sourceKind] = values;
      if (articles.has(url)) return []; // ON CONFLICT (canonical_url) DO NOTHING
      assert.match(text, /ON CONFLICT \(canonical_url\) DO NOTHING/);
      const id = `id-${articles.size + 1}`;
      articles.set(url, { id, canonical_url: url, title, summary, published_at: publishedAt, source_id: sourceId, source_url: sourceUrl, score, categories, relevance: JSON.parse(relevance), metadata: JSON.parse(metadata), source_kind: sourceKind });
      return [{ id }];
    }
    if (/INSERT INTO article_organizations/.test(text)) { links.push(values); return []; }
    throw new Error(`unexpected statement: ${text}`);
  };
  return { sql, articles, links, calls };
}

function request(body, { auth = `Bearer ${SECRET}`, raw } = {}) {
  const headers = { "content-type": "application/json" };
  if (auth !== null) headers.authorization = auth;
  return new Request("https://example.test/api/curated", { method: "POST", headers, body: raw ?? JSON.stringify(body) });
}
function deps(db, env = { CURATED_INGEST_SECRET: SECRET }) {
  const state = { revalidated: 0, dbOpened: 0 };
  return {
    state,
    options: {
      env, now: NOW,
      getSql: async () => { state.dbOpened += 1; return db.sql; },
      revalidate: () => { state.revalidated += 1; },
    },
  };
}

// ---- auth --------------------------------------------------------------------------------------

test("curated auth: 401 without the env var, with no header, a wrong secret or the wrong scheme", async () => {
  for (const [env, auth] of [
    [{}, `Bearer ${SECRET}`],
    [{ CURATED_INGEST_SECRET: "" }, "Bearer "],
    [{ CURATED_INGEST_SECRET: "" }, `Bearer ${SECRET}`],
    [{ CURATED_INGEST_SECRET: SECRET }, null],
    [{ CURATED_INGEST_SECRET: SECRET }, "Bearer wrong"],
    [{ CURATED_INGEST_SECRET: SECRET }, `Bearer ${SECRET}x`],
    [{ CURATED_INGEST_SECRET: SECRET }, SECRET],
    [{ CURATED_INGEST_SECRET: SECRET }, `Basic ${SECRET}`],
  ]) {
    const db = fakeSql();
    const { options, state } = deps(db, env);
    const response = await handleCuratedRequest(request([good()], { auth }), options);
    assert.equal(response.status, 401, `${JSON.stringify(env)} ${auth}`);
    assert.deepEqual(await response.json(), { ok: false, error: "Unauthorized" });
    assert.equal(state.dbOpened, 0, "no database access before auth");
    assert.equal(db.articles.size, 0);
  }
});

test("curated auth: the right secret passes; the compare is constant-time (hashed, timingSafeEqual)", () => {
  assert.equal(isCuratedAuthorised(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(isCuratedAuthorised(`Bearer ${SECRET} `, SECRET), false);
  assert.equal(isCuratedAuthorised(undefined, SECRET), false);
  assert.equal(isCuratedAuthorised(`Bearer ${SECRET}`, undefined), false);
  const source = readFileSync(new URL("../src/curated.js", import.meta.url), "utf8");
  assert.match(source, /timingSafeEqual/);
  assert.doesNotMatch(source, /===\s*secret|secret\s*===|authorization\s*===/);
});

test("curated auth is not the dashboard session: the route needs only the bearer secret", () => {
  const route = readFileSync(new URL("../src/app/api/curated/route.js", import.meta.url), "utf8");
  assert.match(route, /CURATED_INGEST_SECRET|process\.env/);
  assert.doesNotMatch(route, /CRON_SECRET|SESSION_COOKIE/);
  assert.match(route, /export async function POST/);
  assert.doesNotMatch(route, /export async function GET/);
});

// ---- validation --------------------------------------------------------------------------------

test("curated validation: a good item is accepted and normalised", () => {
  const { item, reason } = validateCuratedItem(good(), { now: NOW });
  assert.equal(reason, undefined);
  assert.equal(item.url, "https://www.xblog.gr/i-telekom-lansarei-fiber-router-7/");
  assert.equal(item.category, "telco");
  assert.equal(item.section, "telecom-fibre");
  assert.equal(item.publishedAt, "2026-10-28T14:32:01.000Z");
  assert.equal(item.sourceId, "curated:xblog");
});

test("curated validation: each strict rule rejects with its own reason", () => {
  const cases = {
    url_not_https: { url: "http://www.xblog.gr/a/" },
    url_tracking_params: { url: "https://www.xblog.gr/a/?utm_source=x" },
    url_google_news: { url: "https://news.google.com/rss/articles/CBMiabc?oc=5" },
    url_google_redirect: { url: "https://www.google.com/url?q=https://www.xblog.gr/a/" },
    url_credentials: { url: "https://user:pw@www.xblog.gr/a/" },
    url_bad_host: { url: "https://localhost/a/" },
    url_invalid: { url: "not a url" },
    url_missing: { url: undefined },
    url_too_long: { url: `https://www.xblog.gr/${"a".repeat(500)}` },
    title_too_short: { title_el: "Σύντομος" },
    title_too_long: { title_el: `Ε${"λ".repeat(230)}` },
    title_missing: { title_el: 42 },
    title_markup: { title_el: "Η Telekom <b>λανσάρει</b> νέο router" },
    title_not_greek: { title_el: "Telekom launches the Fiber Router 7 product" },
    summary_too_short: { summary_el: "Μικρό" },
    summary_too_long: { summary_el: `Ε${"λ".repeat(601)}` },
    summary_not_greek: { summary_el: "A new Wi-Fi 7 router free with every FTTH line." },
    source_missing: { source: undefined },
    source_too_short: { source: "x" },
    source_invalid: { source: "<script>" },
    published_at_not_iso_with_offset: { published_at: "2026-10-28T16:32:01" },
    published_at_invalid: { published_at: "2026-13-45T16:32:01+02:00" },
    published_at_in_future: { published_at: "2026-10-30T16:32:01+02:00" },
    published_at_too_old: { published_at: "2024-01-01T10:00:00+02:00" },
    unknown_section: { section: "gossip" },
  };
  for (const [reason, over] of Object.entries(cases)) {
    const out = validateCuratedItem(good(over), { now: NOW });
    assert.equal(out.reason, reason, JSON.stringify(over).slice(0, 80));
  }
  assert.match(validateCuratedItem({ ...good(), score: 99 }, { now: NOW }).reason, /^unknown_field:score/);
  assert.equal(validateCuratedItem("x", { now: NOW }).reason, "not_an_object");
  assert.equal(validateCuratedItem(null, { now: NOW }).reason, "not_an_object");
});

test("curated validation: tracking params are rejected, not silently stripped", () => {
  for (const url of [
    "https://a.gr/x/?utm_campaign=y", "https://a.gr/x/?id=1&utm_medium=z", "https://a.gr/x/?fbclid=abc", "https://a.gr/x/?gclid=1",
  ]) assert.equal(curatedUrlProblem(url), "url_tracking_params", url);
  assert.equal(curatedUrlProblem("https://a.gr/x/?id=1&page=2"), null);
});

test("curated validation: the batch must be an array of 1 to 50", () => {
  assert.ok(validateCuratedBatch({}, { now: NOW }).error);
  assert.ok(validateCuratedBatch("x", { now: NOW }).error);
  assert.ok(validateCuratedBatch([], { now: NOW }).error);
  const many = Array.from({ length: CURATED_MAX_ITEMS + 1 }, (_, i) => good({ url: `https://www.xblog.gr/a-${i}/` }));
  assert.match(validateCuratedBatch(many, { now: NOW }).error, /At most 50/);
  assert.equal(validateCuratedBatch(many.slice(0, CURATED_MAX_ITEMS), { now: NOW }).items.length, CURATED_MAX_ITEMS);
});

test("curated validation: a bad item is rejected by url without failing the others", () => {
  const batch = validateCuratedBatch([good(), good({ url: "http://x.gr/a/" }), "junk"], { now: NOW });
  assert.equal(batch.items.length, 1);
  assert.deepEqual(batch.rejected, [
    { url: "http://x.gr/a/", reason: "url_not_https" },
    { url: "#2", reason: "not_an_object" },
  ]);
});

// ---- filters -----------------------------------------------------------------------------------

test("curated filters: stock-market, promo and CSR/culture items are rejected, a network story is not", () => {
  const reason = (title_el, summary_el) => validateCuratedItem(good({ title_el, summary_el }), { now: NOW }).reason;
  const summary = "Περιγραφή της είδησης στα ελληνικά, με αρκετό κείμενο για να περάσει τον έλεγχο μήκους.";
  assert.equal(reason("Χρηματιστήριο: Συνεχίζονται τα καλά νέα για τον ΟΤΕ σήμερα", summary), "noise:stock_market_headline");
  assert.equal(reason("Πειραιώς: νέο στεγαστικό με επιτόκιο 3%", summary), "noise:bank_promo");
  assert.equal(reason("Χορηγούμενο: Η Cosmote παρουσιάζει νέο δίκτυο", summary), "noise:sponsored");
  assert.equal(reason("Χορηγός του φεστιβάλ κινηματογράφου η Cosmote και η Nova", summary), "noise:culture_csr");
  assert.equal(reason("Η Cosmote επεκτείνει το δίκτυο FTTH σε 200.000 νέα σπίτια", summary), undefined);
  // the read-time half applies too: a stored stock-market row never shows on any page
  const rows = [{
    id: "s", title: "Χρηματιστήριο: Συνεχίζονται τα καλά νέα για τον ΟΤΕ", summary: "", canonical_url: "https://www.xblog.gr/s",
    source_id: "curated:xblog", source_kind: "curated", published_at: new Date(NOW - 2 * HOUR).toISOString(),
    categories: ["telco"], score: CURATED_SCORE, relevance: [], metadata: { sourceKind: "curated" },
  }];
  assert.deepEqual(selectArticles(rows, { category: "telco", now: NOW }), []);
});

// ---- store: same columns as ingest, source marker, idempotent -----------------------------------

test("curated store: writes the ingest columns plus source_kind='curated', tier 1, section category", async () => {
  const db = fakeSql();
  const { items } = validateCuratedBatch([good()], { now: NOW });
  assert.deepEqual(await storeCuratedItems(db.sql, items), { inserted: 1, duplicates: 0 });
  const [row] = [...db.articles.values()];
  assert.equal(row.source_kind, "curated");
  assert.equal(row.canonical_url, "https://www.xblog.gr/i-telekom-lansarei-fiber-router-7/");
  assert.deepEqual(row.categories, ["telco"]);
  assert.equal(row.source_id, "curated:xblog");
  assert.equal(row.metadata.tier, 1);
  assert.equal(row.metadata.sourceKind, "curated");
  assert.equal(row.metadata.publisher, "xblog");
  assert.equal(row.relevance[0].category, "telco");
  assert.equal(row.score, CURATED_SCORE);
  const insert = db.calls.find((call) => /INSERT INTO articles/.test(call.text)).text;
  for (const column of ["canonical_url", "title", "summary", "published_at", "source_id", "source_url", "score", "categories", "relevance", "metadata", "source_kind"]) {
    assert.match(insert, new RegExp(column));
  }
});

test("curated store: organisations are linked like ingest does", async () => {
  const db = fakeSql();
  const { items } = validateCuratedBatch([good({ title_el: "Η Nova διπλασίασε τους πελάτες FTTH και επενδύει €249 εκατ. στο δίκτυο" })], { now: NOW });
  await storeCuratedItems(db.sql, items);
  assert.ok(db.links.length >= 1, "Nova is a known organisation");
  assert.equal(db.links[0][0], "id-1");
});

test("curated endpoint: first send inserts, re-sending the same file is a no-op", async () => {
  const db = fakeSql();
  const { options, state } = deps(db);
  const body = [good(), good({ url: "https://www.naftemporiki.gr/business/2178950/nova/", source: "naftemporiki", title_el: "Nova: Διπλασιάστηκαν οι πελάτες FTTH, επενδύσεις €249,2 εκατ." })];
  const first = await handleCuratedRequest(request(body), options);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true, inserted: 2, duplicates: 0, rejected: [] });
  assert.equal(state.revalidated, 1);
  const second = await handleCuratedRequest(request(body), options);
  assert.deepEqual(await second.json(), { ok: true, inserted: 0, duplicates: 2, rejected: [] });
  assert.equal(state.revalidated, 1, "nothing new, nothing to rebuild");
  assert.equal(db.articles.size, 2);
});

test("curated endpoint: duplicates inside one request, and tracking-free www/non-www copies, count once", async () => {
  const db = fakeSql();
  const { options } = deps(db);
  const body = [good(), good(), good({ url: "https://xblog.gr/i-telekom-lansarei-fiber-router-7" })];
  const out = await (await handleCuratedRequest(request(body), options)).json();
  assert.deepEqual({ inserted: out.inserted, duplicates: out.duplicates, rejected: out.rejected }, { inserted: 1, duplicates: 2, rejected: [] });
});

test("curated endpoint: rejected items are reported with their url and nothing else is stored for them", async () => {
  const db = fakeSql();
  const { options } = deps(db);
  const body = [good(), good({ url: "https://www.xblog.gr/b/?utm_source=x" }), good({ url: "https://news.google.com/rss/articles/abc" }), good({ url: "https://www.xblog.gr/c/", section: "nope" })];
  const out = await (await handleCuratedRequest(request(body), options)).json();
  assert.equal(out.ok, true);
  assert.equal(out.inserted, 1);
  assert.deepEqual(out.rejected, [
    { url: "https://www.xblog.gr/b/?utm_source=x", reason: "url_tracking_params" },
    { url: "https://news.google.com/rss/articles/abc", reason: "url_google_news" },
    { url: "https://www.xblog.gr/c/", reason: "unknown_section" },
  ]);
  assert.equal(db.articles.size, 1);
});

test("curated endpoint: malformed bodies are 400 and a store failure is a 500 that leaks nothing", async () => {
  const db = fakeSql();
  const { options } = deps(db);
  assert.equal((await handleCuratedRequest(request(null, { raw: "{nope" }), options)).status, 400);
  assert.equal((await handleCuratedRequest(request({ url: "x" }), options)).status, 400);
  assert.equal((await handleCuratedRequest(request([]), options)).status, 400);
  const big = await handleCuratedRequest(request(null, { raw: `[${"1,".repeat(200_000)}1]` }), options);
  assert.equal(big.status, 413);
  const failing = { ...options, getSql: async () => { throw new Error("connect ECONNREFUSED secret-host"); } };
  const response = await handleCuratedRequest(request([good()]), failing);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { ok: false, error: "Could not store items" });
});

test("curated rows are protected from the scan: ingest never overwrites or reclassifies them", () => {
  const ingest = readFileSync(new URL("../src/ingest-service.js", import.meta.url), "utf8");
  assert.match(ingest, /WHERE articles\.source_kind IS DISTINCT FROM 'curated'/);
  assert.match(ingest, /FROM articles WHERE source_kind IS DISTINCT FROM 'curated'/);
});

test("curated migration is additive and idempotent, in both the runtime schema and db/schema.sql", () => {
  for (const file of ["../src/database.js", "../db/schema.sql"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_kind TEXT(?! NOT NULL)/, file);
    assert.match(source, /CREATE INDEX IF NOT EXISTS articles_source_kind_idx/, file);
    assert.doesNotMatch(source, /DROP (TABLE|COLUMN)/i, file);
  }
});

// ---- read side: curated rows and homepage/section parity -------------------------------------------

function stored(id, title, { hoursAgo = 2, source = `src-${id}`, categories = ["telco"], score = 20, curated = false, summary = "" } = {}) {
  return {
    id, title, summary, canonical_url: `https://news${id}.gr/a${id}`, source_id: curated ? `curated:${source}` : source,
    published_at: new Date(NOW - hoursAgo * HOUR).toISOString(), categories, score, relevance: [],
    metadata: curated ? { sourceKind: "curated", tier: 1, publisher: source } : {},
    ...(curated ? { source_kind: "curated" } : {}),
  };
}

const TELCO_TITLES = [
  "Η Cosmote επεκτείνει το δίκτυο FTTH σε 200.000 νέα σπίτια",
  "Η Nova ενεργοποιεί 5G στο 93% του πληθυσμού",
  "Η ΕΕΤΤ δημοπρατεί φάσμα 5G για κινητή τηλεφωνία",
  "Ο ΟΤΕ ολοκληρώνει την επέκταση του FTTH στην Κρήτη",
  "Η Cosmote ανακοινώνει επέκταση 5G στα νησιά του Αιγαίου",
  "Η ΔΕΗ Fiber φτάνει 1,5 εκατ. σπίτια με FTTH",
  "Η Vodafone ενεργοποιεί 5G Standalone σε όλη την Ελλάδα",
];

test("curated rows keep their section at read time, even when the rules would not file the headline under it", () => {
  const rows = [
    stored("c1", "Νέα ψηφιακή υπηρεσία για τους πελάτες της εταιρείας", { curated: true, source: "xblog", score: 0, hoursAgo: 5 }),
    stored("n1", "Παράταση προθεσμίας για τους πελάτες της εταιρείας", { source: "other", hoursAgo: 5 }),
  ];
  const telco = selectArticles(rows, { category: "telco", now: NOW, limit: 100 });
  assert.deepEqual(telco.map((a) => a.id), ["c1"], "curated stays, the same headline from a scanned source is dropped by the rules");
  assert.equal(telco[0].metadata.curated, true);
  assert.equal(telco[0].sourceName, "xblog");
  assert.equal(telco[0].url, "https://news" + "c1.gr/a" + "c1", "links point at the publisher url");
});

test("curated rows skip the score floors on the homepage (fresh floor and backfill floor)", () => {
  const rows = [
    stored("c1", "Νέα ψηφιακή υπηρεσία για τους πελάτες της εταιρείας", { curated: true, source: "xblog", score: 0, hoursAgo: 4 }),
    stored("c2", "Νέα ψηφιακή υπηρεσία δικτύου για τους συνδρομητές", { curated: true, source: "naftemporiki", score: 0, hoursAgo: 24 * 6 }),
  ];
  const { articles, sections } = selectHomepageInputs(rows, { now: NOW });
  const home = buildHomepageSections(articles, { now: NOW, sections });
  const shown = [home.lead, ...home.recent, ...Object.values(home.columns).flat()].filter(Boolean).map((a) => a.id).sort();
  assert.deepEqual(shown, ["c1", "c2"]);
});

test("homepage columns are the top of their section page: same list, same order, up to the section cap", () => {
  const rows = [
    ...TELCO_TITLES.map((title, i) => stored(`t${i}`, title, { hoursAgo: 2 + i })),
    stored("e1", "Ο ΑΔΜΗΕ προχωρά στη διασύνδεση Κρήτης με ηλεκτρικό καλώδιο 400 εκατ.", { categories: ["energy"], hoursAgo: 3 }),
  ];
  const { articles, sections } = selectHomepageInputs(rows, { now: NOW });
  assert.ok(sections.telco.length >= 6, "more telco stories than the column cap");
  const home = buildHomepageSections(articles, { now: NOW, sections });
  const all = [home.lead, ...home.recent, ...Object.values(home.columns).flat()].filter(Boolean);

  // The 35% share rule (round 6) still trims an over-share section on a thin day, so the column
  // can be shorter than the cap; it is never longer, and what it holds is the top of the page.
  const telcoOnHome = all.filter((a) => a.categories[0] === "telco");
  assert.ok(telcoOnHome.length >= 3 && telcoOnHome.length <= SECTION_HOMEPAGE_CAPS["telecom-fibre"]);
  assert.equal(home.recent.filter((a) => a.categories[0] === "telco").length, 0, "no /telco headliner is parked in the catch-all list");
  assert.ok(home.columns.telco.length >= 2, "the telco column is filled from /telco");

  for (const [slug, column] of Object.entries(home.columns)) {
    const pageOrder = sections[slug].map((a) => a.url);
    const positions = column.map((a) => pageOrder.indexOf(a.url));
    assert.ok(positions.every((p) => p >= 0), `${slug}: every column story is on its section page`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, `${slug}: column keeps the page order`);
  }
  assert.equal(new Set(all.map((a) => a.url)).size, all.length, "each story appears once on the homepage");
});

test("a thin-day share trim drops a scanned story before a curated one", () => {
  const rows = [
    stored("c1", "Η Telekom λανσάρει το Fiber Router 7 και την υπηρεσία Power WiFi", { curated: true, source: "xblog", hoursAgo: 1, score: CURATED_SCORE }),
    ...TELCO_TITLES.slice(0, 4).map((title, i) => stored(`t${i}`, title, { hoursAgo: 2 + i })),
  ];
  const { articles, sections } = selectHomepageInputs(rows, { now: NOW });
  const home = buildHomepageSections(articles, { now: NOW, sections });
  const all = [home.lead, ...home.recent, ...Object.values(home.columns).flat()].filter(Boolean);
  assert.ok(all.some((a) => a.id === "c1"), "the curated story survives the trim");
});

test("a multi-tag story counts once, under its main section, not in the other section's column", () => {
  const rows = [
    stored("m1", "Η Cosmote επεκτείνει το δίκτυο FTTH σε 200.000 νέα σπίτια", { hoursAgo: 1 }),
    stored("m2", "Η Nova ενεργοποιεί 5G στο 93% του πληθυσμού", { hoursAgo: 2 }),
  ];
  const { articles } = selectHomepageInputs(rows, { now: NOW });
  // m1 is filed under deals first and telco second; the telco section page lists it, its main section is deals
  const tagged = articles.map((a) => (a.id === "m1" ? { ...a, categories: ["deals", "telco"] } : a));
  const sections = { telco: tagged, deals: [tagged[0]], energy: [], infrastructure: [], tenders: [], regulators: [] };
  const home = buildHomepageSections(tagged, { now: NOW, sections });
  const all = [home.lead, ...home.recent, ...Object.values(home.columns).flat()].filter(Boolean);
  assert.equal(all.filter((a) => a.id === "m1").length, 1);
  assert.ok(!home.columns.telco.some((a) => a.id === "m1"), "not in the telco column");
});

test("curated telco items show in the homepage telco column and on /telco", () => {
  const rows = [
    stored("c1", "Η Telekom λανσάρει το Fiber Router 7 και την υπηρεσία Power WiFi", { curated: true, source: "xblog", hoursAgo: 8, score: CURATED_SCORE }),
    stored("c2", "Nova: Διπλασιάστηκαν οι πελάτες FTTH, επενδύσεις €249,2 εκατ.", { curated: true, source: "naftemporiki", hoursAgo: 30, score: CURATED_SCORE }),
    stored("t0", TELCO_TITLES[0], { hoursAgo: 40 }),
  ];
  const { articles, sections } = selectHomepageInputs(rows, { now: NOW });
  assert.deepEqual(sections.telco.map((a) => a.id), ["c1", "c2", "t0"]);
  const home = buildHomepageSections(articles, { now: NOW, sections });
  const shown = [home.lead, ...home.recent, ...Object.values(home.columns).flat()].filter(Boolean).map((a) => a.id);
  for (const id of ["c1", "c2", "t0"]) assert.ok(shown.includes(id), id);
  const telcoOnHome = [home.lead, ...home.columns.telco].filter(Boolean).map((a) => a.id);
  assert.ok(telcoOnHome.includes("c1") && telcoOnHome.includes("c2"), "both curated items are the lead or in the telco column, not in the catch-all list");
});

// ---- sender script -------------------------------------------------------------------------------

test("send-curated.sh reads the secret from GRWIRE_CURATED_SECRET and never echoes it or puts it on a command line", () => {
  const script = readFileSync(new URL("../scripts/send-curated.sh", import.meta.url), "utf8");
  assert.match(script, /GRWIRE_CURATED_SECRET/);
  assert.match(script, /--header @<\(printf/);
  assert.doesNotMatch(script, /echo[^\n]*\$\{?GRWIRE_CURATED_SECRET/);
  assert.equal((script.match(/\$GRWIRE_CURATED_SECRET/g) || []).length, 1, "used once, in the header pipe");
  assert.doesNotMatch(script, /--header "Authorization/);
  assert.doesNotMatch(script, /set -x|set -o xtrace/);
});
