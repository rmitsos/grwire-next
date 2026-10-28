import test from "node:test";
import assert from "node:assert/strict";
import { buildReviewDump, toRow, toAthensIso } from "../scripts/review-dump.js";

const NOW = new Date("2026-10-25T12:00:00Z").getTime();

test("toAthensIso renders Europe/Athens local time with the correct EET/EEST offset", () => {
  assert.equal(toAthensIso(new Date("2026-01-15T10:00:00Z")), "2026-01-15T12:00:00+02:00"); // EET, winter
  assert.equal(toAthensIso(new Date("2026-07-15T10:00:00Z")), "2026-07-15T13:00:00+03:00"); // EEST, summer
});

test("toRow converts a scanMarket item into the DB row shape, deduping categories from relevance", () => {
  const row = toRow({
    url: "https://x.test/a", title: "T", summary: "S", publishedAt: "2026-10-24T09:00:00.000Z",
    sourceId: "src-1", score: 7, metadata: { foo: "bar" },
    relevance: [{ category: "telco", score: 7 }, { category: "telco", score: 5 }],
  }, 3);
  assert.deepEqual(row, {
    id: 3, canonical_url: "https://x.test/a", title: "T", summary: "S",
    published_at: "2026-10-24T09:00:00.000Z", source_id: "src-1", source_url: "https://x.test/a",
    score: 7, categories: ["telco"], relevance: [{ category: "telco", score: 7 }, { category: "telco", score: 5 }],
    metadata: { foo: "bar" },
  });
});

function item({ url, title, sourceId, publishedAt, metadata, score = 0 }) {
  return { url, title, summary: "", sourceId, publishedAt, score, relevance: [], metadata };
}

const DAY_CAP_WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "india", "juliet"];

const REPORT = {
  scannedAt: "2026-10-25T10:00:00.000Z",
  fetched: 20,
  relevant: 16,
  items: [
    // Dropped: ppc_non_network (sponsorship) — round-3 owner answer.
    item({
      url: "https://ppcgroup.com/sponsorship",
      title: "ΔΕΗ: Χρυσός Χορηγός του 32ου Διεθνούς Φεστιβάλ Κινηματογράφου",
      sourceId: "ppc-press", publishedAt: "2026-10-24T09:00:00.000Z",
    }),
    // Kept: ppc-press fibre release -> energy + telco.
    item({
      url: "https://ppcgroup.com/fiber-ftth",
      title: "ΔΕΗ Fiber: νέες περιοχές FTTH",
      sourceId: "ppc-press", publishedAt: "2026-10-24T10:00:00.000Z",
    }),
    // Kept via the tenders/regulators rules-only override, not any watch rule.
    item({
      url: "https://ypodomes.com/tender-1",
      title: "Διαγωνισμός κατακύρωση ανάθεση σύμβασης προκήρυξης για έργο οδοποιίας",
      sourceId: "test-infra-src", publishedAt: "2026-10-24T11:00:00.000Z",
    }),
    // Kept: clean telco story, higher score -> survives dedupe as the lead/column candidate.
    item({
      url: "https://a.test/cosmote-ftth",
      title: "Η Cosmote επεκτείνει δίκτυο FTTH οπτικών ινών σε νέους δήμους της Ελλάδας",
      sourceId: "test-telco-src-a", publishedAt: "2026-10-25T09:00:00.000Z", score: 10,
    }),
    // Dropped: duplicate (near-identical title, close in time, lower score -> loses the tie-break).
    item({
      url: "https://b.test/cosmote-ftth-2",
      title: "Η Cosmote επεκτείνει δίκτυο FTTH οπτικών ινών σε νέους δήμους Ελλάδας",
      sourceId: "test-telco-src-b", publishedAt: "2026-10-25T08:00:00.000Z", score: 5,
    }),
    // sectionOnly: excluded from the homepage, still listed on its section page.
    item({
      url: "https://news.google.com/rss/articles/CBMitest",
      title: "ΟΤΕ FTTH αποκλειστικό δίκτυο επέκταση στην Ελλάδα",
      sourceId: "test-gnews", publishedAt: "2026-10-25T07:00:00.000Z",
      metadata: { sectionOnly: true },
    }),
    // Stale: outside the 72h homepage window, but still on the section page's "older" list.
    item({
      url: "https://a.test/old-ote-ftth",
      title: "Παλιό άρθρο για δίκτυο FTTH οπτικών ινών της ΟΤΕ στην Ελλάδα",
      sourceId: "test-telco-src-a", publishedAt: "2026-10-10T09:00:00.000Z",
    }),
    // Day cap: 9 items from the same source on the same Athens day; the default cap is 8.
    ...DAY_CAP_WORDS.map((word, i) => item({
      url: `https://daycap.test/${word}`,
      title: `Generic wire item ${word}`,
      sourceId: "test-daycap-src", publishedAt: `2026-10-25T0${i}:00:00.000Z`,
    })),
  ],
  sources: [
    { id: "ppc-press", ok: true, fetched: 2, accepted: 2, noiseRejected: 0, dayCapped: 0 },
    { id: "test-infra-src", ok: true, fetched: 1, accepted: 1, noiseRejected: 0, dayCapped: 0 },
    { id: "test-telco-src-a", ok: true, fetched: 2, accepted: 2, noiseRejected: 0, dayCapped: 0 },
    { id: "test-telco-src-b", ok: true, fetched: 1, accepted: 1, noiseRejected: 0, dayCapped: 0 },
    { id: "test-gnews", ok: true, fetched: 1, accepted: 1, noiseRejected: 0, dayCapped: 0 },
    { id: "test-daycap-src", ok: true, fetched: 9, accepted: 9, noiseRejected: 0, dayCapped: 0 },
    { id: "test-broken-src", ok: false, fetched: 0, error: "fetch failed" },
  ],
};

test("buildReviewDump: header carries the rules summary and the Europe/Athens generatedAt note", () => {
  const dump = buildReviewDump(REPORT, { now: NOW, branch: "feat/insights", commit: "abc123" });
  assert.equal(dump.header.branch, "feat/insights");
  assert.equal(dump.header.commit, "abc123");
  assert.match(dump.header.generatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/);
  assert.match(dump.header.note, /WITHOUT a database/);
  assert.match(dump.header.note, /will differ from the preview/);
  assert.equal(dump.header.rules.homepageMaxItems, 20);
  assert.equal(dump.header.rules.maxAgeHoursNews, 72);
  assert.equal(dump.header.rules.sectionHomepageCaps["deals-companies"], 2);
});

test("buildReviewDump: ppc-press sponsorship is dropped ppc_non_network, the fibre release is kept energy+telco", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const sponsorshipDrop = dump.dropped.find((d) => d.url === "https://ppcgroup.com/sponsorship");
  assert.ok(sponsorshipDrop, "expected the sponsorship release in the dropped list");
  assert.equal(sponsorshipDrop.reason.group, "ppc_non_network");

  const fibreItem = dump.sections.energy.fresh.find((a) => a.url === "https://ppcgroup.com/fiber-ftth");
  assert.ok(fibreItem, "expected the fibre release on the energy section page");
  assert.ok(fibreItem.sections.includes("telco"), `expected telco among ${fibreItem.sections}`);
});

test("buildReviewDump: tenders-only item is filed under tenders via the rules override, not a watch rule", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const tenderItem = dump.sections.tenders.fresh.find((a) => a.url === "https://ypodomes.com/tender-1");
  assert.ok(tenderItem, "expected the tender item on the tenders section page");
  assert.equal(tenderItem.homepageSection, "tenders-contracts");
});

test("buildReviewDump: near-duplicate telco story is dropped, the higher-scored original survives", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const duplicateDrop = dump.dropped.find((d) => d.url === "https://b.test/cosmote-ftth-2");
  assert.ok(duplicateDrop, "expected the near-duplicate story in the dropped list");
  assert.equal(duplicateDrop.reason.stage, "duplicate");
  const survivor = dump.sections.telco.fresh.find((a) => a.url === "https://a.test/cosmote-ftth");
  assert.ok(survivor, "expected the original story to survive on the telco section page");
});

test("buildReviewDump: a sectionOnly item is excluded from the homepage but listed on its section page", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const onHomepage = [dump.homepage.lead, ...dump.homepage.recent, ...Object.values(dump.homepage.columns).flat()]
    .filter(Boolean).some((a) => a.url === "https://news.google.com/rss/articles/CBMitest");
  assert.equal(onHomepage, false, "sectionOnly items must not appear on the homepage");

  const sectionItem = dump.sections.telco.fresh.find((a) => a.url === "https://news.google.com/rss/articles/CBMitest");
  assert.ok(sectionItem, "expected the sectionOnly item on its section page");
  assert.equal(sectionItem.sectionOnly, true);

  const sectionOnlyDrop = dump.dropped.find((d) => d.url === "https://news.google.com/rss/articles/CBMitest");
  assert.ok(sectionOnlyDrop, "expected a section_only drop recorded for the homepage pass");
  assert.equal(sectionOnlyDrop.reason.stage, "section_only");
});

test("buildReviewDump: a >72h-old item lands in its section's older list and is flagged stale for the homepage", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const older = dump.sections.telco.older.find((a) => a.url === "https://a.test/old-ote-ftth");
  assert.ok(older, "expected the stale item in the telco section's older list");
  assert.ok(!dump.sections.telco.fresh.some((a) => a.url === "https://a.test/old-ote-ftth"));

  const staleDrop = dump.dropped.find((d) => d.url === "https://a.test/old-ote-ftth" && d.reason.stage === "stale");
  assert.ok(staleDrop, "expected a stale drop recorded for the homepage pass");
});

test("buildReviewDump: the per-source day cap (default 8) drops the 9th same-day item from one source", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const dayCapDrops = dump.dropped.filter((d) => d.sourceId === "test-daycap-src" && d.reason.stage === "day_cap");
  assert.equal(dayCapDrops.length, 1, `expected exactly 1 day_cap drop, got ${JSON.stringify(dayCapDrops)}`);
});

test("buildReviewDump: perSource reports fetched/kept/noiseRejected/shownOnHomepage/error per source", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const byId = Object.fromEntries(dump.perSource.map((s) => [s.id, s]));

  assert.equal(byId["test-broken-src"].error, "fetch failed");
  assert.equal(byId["test-broken-src"].kept, 0);

  const telcoSrcA = byId["test-telco-src-a"];
  assert.equal(telcoSrcA.fetched, 2);
  assert.equal(telcoSrcA.kept, 2);
  assert.ok(telcoSrcA.shownOnHomepage >= 1, "expected the surviving Cosmote FTTH story on the homepage");

  const daycapSrc = byId["test-daycap-src"];
  assert.equal(daycapSrc.fetched, 9);
  assert.equal(daycapSrc.name, "test-daycap-src", "falls back to the id when the source isn't in config/sources.js");
});

test("buildReviewDump: output items carry title/source/url/publishedAt/sections/homepageSection/score/sectionOnly", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const fibreItem = dump.sections.energy.fresh.find((a) => a.url === "https://ppcgroup.com/fiber-ftth");
  assert.deepEqual(Object.keys(fibreItem).sort(), [
    "homepageSection", "publishedAt", "score", "sectionOnly", "sections", "source", "title", "url",
  ]);
  assert.deepEqual(fibreItem.source, { id: "ppc-press", name: "ΔΕΗ – Δελτία Τύπου (μηνιαία σελίδα)" });
  assert.match(fibreItem.publishedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:00$/);
});

// --- round-4 additions -------------------------------------------------------

test("buildReviewDump: homepage items (only) carry homepageBackfill, and leadReason explains the chosen lead", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const homepageItems = [dump.homepage.lead, ...dump.homepage.recent, ...Object.values(dump.homepage.columns).flat()].filter(Boolean);
  for (const item of homepageItems) assert.equal(typeof item.homepageBackfill, "boolean");
  assert.ok(dump.homepage.leadReason, "expected a leadReason for the chosen lead");
  assert.equal(dump.homepage.leadReason.sourceId, dump.homepage.lead.source.id);
  assert.equal(typeof dump.homepage.leadReason.hasFigureOrDecisionSignal, "boolean");
});

test("buildReviewDump: scanDrops (scanMarket's onDrop, for items that never reached report.items) are merged into dropped", () => {
  const fakeScanDrop = {
    item: { title: "Ανακοίνωση ΡΑΑΕΥ χωρίς κατηγορία", url: "https://raaey.test/dropped-at-scan", sourceId: "raaey-energy-announcements" },
    reason: { stage: "no_category" },
  };
  const dump = buildReviewDump(REPORT, { now: NOW, scanDrops: [fakeScanDrop] });
  const drop = dump.dropped.find((d) => d.url === "https://raaey.test/dropped-at-scan");
  assert.ok(drop, "expected the scanMarket-level drop to appear in the dump");
  assert.equal(drop.reason.stage, "no_category");
  assert.equal(drop.sourceId, "raaey-energy-announcements");
});

test("buildReviewDump: navVisibility reports tenders/regulators shown/hidden with counts", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  assert.equal(typeof dump.navVisibility.tenders.shown, "boolean");
  assert.equal(typeof dump.navVisibility.regulators.shown, "boolean");
  assert.equal(typeof dump.navVisibility.tenders.count, "number");
});

test("buildReviewDump: perSource carries a droppedByStage breakdown (keyed by reason.stage)", () => {
  const dump = buildReviewDump(REPORT, { now: NOW });
  const byId = Object.fromEntries(dump.perSource.map((s) => [s.id, s]));
  assert.equal(byId["test-daycap-src"].droppedByStage.day_cap, 1);
  const ppcDrop = dump.dropped.find((d) => d.url === "https://ppcgroup.com/sponsorship");
  assert.equal(ppcDrop.reason.group, "ppc_non_network");
  assert.equal(byId["ppc-press"].droppedByStage[ppcDrop.reason.stage], 1);
});

// round-4 fix: buildHomepageSections runs before the stale/backfill_not_needed
// pass now, so a backfilled (>72h but <=7d old) article that does land on the
// homepage must never also show up in `dropped`; a not-shown item inside the
// 7-day backfill window with no other reason gets "backfill_not_needed"
// instead of "stale"; "stale" is reserved for items outside that window.
const BACKFILL_OLDER_DEFS = [
  ["telco1", "Η Vodafone εγκαινίασε νέο δίκτυο 5G σε αγροτικές περιοχές της Ελλάδας"],
  ["telco2", "Η Nova ανακοίνωσε αναβάθμιση του δικτύου οπτικών ινών σε παραμεθόριες περιοχές της Ελλάδας"],
  ["energy1", "Η ΔΕΔΔΗΕ ανακοίνωσε αναβάθμιση γραμμών διανομής ηλεκτρικής ενέργειας στην Ελλάδα"],
  ["energy2", "Η ΡΑΑΕΥ εξέδωσε απόφαση για αποθήκευση ενέργειας σε μπαταρίες στην Ελλάδα"],
  ["infra1", "Έναρξη κατασκευής νέας σήραγγας στον αυτοκινητόδρομο Αθηνών-Κορίνθου"],
  ["infra2", "Το ΥΠΕΝ ενέκρινε χωροθέτηση νέου σιδηροδρομικού έργου στη Θεσσαλονίκη"],
  ["tenders1", "Προκήρυξη διαγωνισμού για ανάθεση σύμβασης έργου ύδρευσης στην Κρήτη"],
  ["tenders2", "Κατακύρωση σύμβασης προμήθειας εξοπλισμού σε διαγωνισμό του δημοσίου"],
  ["regulators1", "Η ΕΕΤΤ δημοσίευσε διαβούλευση για τροπολογία κανονισμού φάσματος"],
  ["regulators2", "Το Υπουργείο Ψηφιακής Διακυβέρνησης ανακοίνωσε νομοσχέδιο για το φάσμα συχνοτήτων"],
  ["deals1", "Η Metlen ανακοίνωσε εξαγορά startup σε συμφωνία M&A στην Ελλάδα"],
];

const BACKFILL_REPORT = {
  items: [
    item({ url: "https://a.test/fresh-telco", title: "Η Cosmote επεκτείνει δίκτυο FTTH οπτικών ινών σε νέους δήμους της Ελλάδας", sourceId: "fresh-telco-src", publishedAt: "2026-10-25T11:00:00.000Z", score: 10 }),
    item({ url: "https://a.test/fresh-energy", title: "Ο ΑΔΜΗΕ ανακοίνωσε νέα διασύνδεση υποσταθμού υψηλής τάσης στην Ελλάδα", sourceId: "fresh-energy-src", publishedAt: "2026-10-25T11:00:00.000Z", score: 10 }),
    ...BACKFILL_OLDER_DEFS.map(([key, title], i) => item({
      url: `https://a.test/older-${key}`, title, sourceId: `older-src-${key}`,
      publishedAt: new Date(NOW - (4 + i * 0.18) * 24 * 3_600_000).toISOString(), score: 5,
    })),
    item({
      url: "https://a.test/too-old", title: "Η Nova ανακοίνωσε παλιά επέκταση δικτύου FTTH οπτικών ινών στην Ελλάδα πριν καιρό",
      sourceId: "too-old-src", publishedAt: new Date(NOW - 10 * 24 * 3_600_000).toISOString(), score: 5,
    }),
  ],
  sources: [],
};

test("buildReviewDump: a backfilled homepage item is never also recorded as dropped", () => {
  const dump = buildReviewDump(BACKFILL_REPORT, { now: NOW });
  const shown = [dump.homepage.lead, ...dump.homepage.recent, ...Object.values(dump.homepage.columns).flat()].filter(Boolean);
  assert.equal(shown.length, 12, `expected the 12-item backfill floor, got ${shown.length}`);
  const backfilled = shown.filter((a) => a.homepageBackfill);
  assert.ok(backfilled.length >= 8, `expected most of the 12 to be backfilled, got ${backfilled.length}`);
  for (const article of shown) {
    assert.ok(!dump.dropped.some((d) => d.url === article.url), `shown article ${article.url} must not appear in dropped`);
  }
});

test("buildReviewDump: a not-shown item inside the 7-day backfill window with no other reason is backfill_not_needed, not stale", () => {
  const dump = buildReviewDump(BACKFILL_REPORT, { now: NOW });
  const leftover = dump.dropped.find((d) => d.url === "https://a.test/older-regulators2");
  assert.ok(leftover, "expected the unused backfill-window candidate to be recorded as dropped");
  assert.equal(leftover.reason.stage, "backfill_not_needed");
});

test("buildReviewDump: an item outside the 7-day backfill window is stale even when buildHomepageSections runs first", () => {
  const dump = buildReviewDump(BACKFILL_REPORT, { now: NOW });
  const staleDrop = dump.dropped.find((d) => d.url === "https://a.test/too-old");
  assert.ok(staleDrop, "expected the >7-day-old item to be recorded as dropped");
  assert.equal(staleDrop.reason.stage, "stale");
});
