import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKFILL_MAX_AGE_HOURS,
  TIER1_BACKFILL_MAX_AGE_HOURS,
  HOMEPAGE_TARGET_ITEMS,
  BACKFILL_MIN_SCORE,
  TIER1_BACKFILL_MIN_SCORE,
  HOMEPAGE_MAX_ITEMS,
  isAgendaItem,
  isEventPiece,
  hasTier1ActionWord,
} from "../src/feed-rules.js";
import {
  buildHomepageSections,
  homepageBackfillWindowHours,
  homepageBackfillIneligibleReason,
} from "../src/public-data.js";
import { buildReviewDump } from "../scripts/review-dump.js";

const DAY = 24 * 3_600_000;
const iso = (now, days) => new Date(now - days * DAY).toISOString();

function article({ url, title, sourceId, categories = ["telco"], score, publishedAt }) {
  return { url, title, summary: "", sourceId, categories, score, publishedAt, metadata: {} };
}

function shownOf(result) {
  return [result.lead, ...result.recent, ...Object.values(result.columns).flat()].filter(Boolean);
}

const CONSULTATION = "Δημόσια Διαβούλευση της ΡΑΑΕΥ επί του Προγράμματος Ανάπτυξης του ΔΕΔΔΗΕ";
const PLAIN_TITLE = "Ο ΑΔΜΗΕ ανακοίνωσε νέο υποσταθμό υψηλής τάσης";

test("round-6 constants: 7-day / 21-day windows, target 10, floors 10 and 20", () => {
  assert.equal(BACKFILL_MAX_AGE_HOURS, 24 * 7);
  assert.equal(TIER1_BACKFILL_MAX_AGE_HOURS, 24 * 21);
  assert.equal(HOMEPAGE_TARGET_ITEMS, 10);
  assert.equal(BACKFILL_MIN_SCORE, 10);
  assert.equal(TIER1_BACKFILL_MIN_SCORE, 20);
  assert.equal(HOMEPAGE_MAX_ITEMS, 20);
});

test("homepageBackfillWindowHours: 21 days only for a tier-1 source's action-word title, else 7 days", () => {
  assert.ok(hasTier1ActionWord(CONSULTATION));
  assert.equal(homepageBackfillWindowHours({ sourceId: "raaey-energy-announcements", title: CONSULTATION }), TIER1_BACKFILL_MAX_AGE_HOURS);
  assert.equal(homepageBackfillWindowHours({ sourceId: "raaey-energy-announcements", title: "Η ΡΑΑΕΥ συνεδρίασε χθες" }), BACKFILL_MAX_AGE_HOURS);
  assert.equal(homepageBackfillWindowHours({ sourceId: "some-news-site", title: CONSULTATION }), BACKFILL_MAX_AGE_HOURS);
});

test("backfill: a tier-1 formal act 8-21 days old with score >= 20 backfills, flagged homepageBackfillTier1", () => {
  const now = Date.now();
  const consultation = article({
    url: "https://raaey.test/consultation", title: CONSULTATION, sourceId: "raaey-energy-announcements",
    categories: ["energy", "regulators"], score: 20, publishedAt: iso(now, 15),
  });
  const shown = shownOf(buildHomepageSections([consultation], { now }));
  assert.equal(shown.length, 1);
  assert.equal(shown[0].homepageBackfill, true);
  assert.equal(shown[0].homepageBackfillTier1, true);
});

test("backfill: a tier-1 formal act within 7 days is a plain backfill (not flagged tier-1) and needs only score 10", () => {
  const now = Date.now();
  const consultation = article({
    url: "https://raaey.test/consultation", title: CONSULTATION, sourceId: "raaey-energy-announcements",
    categories: ["energy", "regulators"], score: 10, publishedAt: iso(now, 5),
  });
  const shown = shownOf(buildHomepageSections([consultation], { now }));
  assert.equal(shown.length, 1);
  assert.equal(shown[0].homepageBackfill, true);
  assert.equal(shown[0].homepageBackfillTier1, undefined);
});

test("backfill: the 21-day band needs score >= 20 after the boost (19 stays out) and ends at 21 days", () => {
  const now = Date.now();
  const make = (suffix, score, days) => article({
    url: `https://raaey.test/${suffix}`, title: CONSULTATION, sourceId: "raaey-energy-announcements",
    categories: ["energy", "regulators"], score, publishedAt: iso(now, days),
  });
  assert.equal(shownOf(buildHomepageSections([make("a", 19, 15)], { now })).length, 0, "score 19 is under the 8-21-day floor");
  assert.equal(shownOf(buildHomepageSections([make("b", 20, 20.9)], { now })).length, 1, "20.9 days old still qualifies");
  assert.equal(shownOf(buildHomepageSections([make("c", 99, 22)], { now })).length, 0, "older than 21 days never backfills");
});

test("backfill: 8-21 days is tier-1 formal acts only (non-tier-1 and tier-1 without an action word stay out)", () => {
  const now = Date.now();
  const nonTier1 = article({
    url: "https://news.test/old", title: CONSULTATION, sourceId: "some-news-site",
    categories: ["energy"], score: 80, publishedAt: iso(now, 10),
  });
  const tier1NoAction = article({
    url: "https://raaey.test/old-news", title: "Η ΡΑΑΕΥ ενημερώνει για την αγορά ενέργειας", sourceId: "raaey-energy-announcements",
    categories: ["energy"], score: 80, publishedAt: iso(now, 10),
  });
  assert.equal(shownOf(buildHomepageSections([nonTier1, tier1NoAction], { now })).length, 0);
});

test("backfill: within 7 days the floor is score 10 (9 stays out, 10 comes in)", () => {
  const now = Date.now();
  const make = (suffix, score) => article({
    url: `https://a.test/${suffix}`, title: PLAIN_TITLE, sourceId: `src-${suffix}`,
    categories: ["energy"], score, publishedAt: iso(now, 4),
  });
  assert.equal(shownOf(buildHomepageSections([make("nine", 9)], { now })).length, 0);
  const ten = shownOf(buildHomepageSections([make("ten", 10)], { now }));
  assert.equal(ten.length, 1);
  assert.equal(ten[0].homepageBackfill, true);
});

test("backfill: agenda items and event pieces never backfill, whatever their score", () => {
  const now = Date.now();
  const agendaTitle = "Σταύρος Παπασταύρου σε Πάτμο και Λέρο: «Με έργα που δίνουν λύσεις, στηρίζουμε έμπρακτα τα νησιά μας»";
  const eventTitle = "Digital Forum Athens 2026";
  assert.ok(isAgendaItem(agendaTitle));
  assert.ok(isEventPiece(eventTitle));
  const items = [
    article({ url: "https://a.test/agenda", title: agendaTitle, sourceId: "ypen-energy-announcements", categories: ["infrastructure"], score: 99, publishedAt: iso(now, 4) }),
    article({ url: "https://a.test/event", title: eventTitle, sourceId: "event-src", categories: ["telco"], score: 99, publishedAt: iso(now, 4) }),
  ];
  assert.equal(shownOf(buildHomepageSections(items, { now })).length, 0);
  assert.equal(homepageBackfillIneligibleReason(items[0], now), "agenda_item");
  assert.equal(homepageBackfillIneligibleReason(items[1], now), "event_piece");
});

test("backfill: a formal act that starts with the action word stays eligible despite an agenda-shaped tail (r5 override)", () => {
  const now = Date.now();
  const title = "Δημόσια Διαβούλευση για τη συμμετοχή του Γενικού Γραμματέα στο συνέδριο ενέργειας";
  assert.ok(!isAgendaItem(title));
  const item = article({
    url: "https://raaey.test/formal", title, sourceId: "raaey-energy-announcements",
    categories: ["energy", "regulators"], score: 25, publishedAt: iso(now, 12),
  });
  // an event word in the title would still block it, so only check the agenda side here
  assert.equal(homepageBackfillIneligibleReason(item, now) === "agenda_item", false);
});

test("backfill ordering: fresh items come first, then backfill by score desc, ties newest first (7-day before 8-21-day)", () => {
  const now = Date.now();
  const fresh = article({
    url: "https://a.test/fresh", title: "Η Cosmote επεκτείνει το δίκτυο FTTH σε νέους δήμους", sourceId: "fresh-src",
    categories: ["telco"], score: 12, publishedAt: iso(now, 0.1),
  });
  const olderTier1 = article({
    url: "https://raaey.test/older", title: CONSULTATION, sourceId: "raaey-energy-announcements",
    categories: ["energy", "regulators"], score: 30, publishedAt: iso(now, 15),
  });
  const newerSameScore = article({
    url: "https://a.test/newer", title: PLAIN_TITLE, sourceId: "newer-src",
    categories: ["infrastructure"], score: 30, publishedAt: iso(now, 4),
  });
  const lowerScore = article({
    url: "https://a.test/lower", title: "Ανακοίνωση έργου υποδομών στην Κρήτη", sourceId: "lower-src",
    categories: ["tenders"], score: 14, publishedAt: iso(now, 5),
  });
  const result = buildHomepageSections([lowerScore, olderTier1, newerSameScore, fresh], { now });
  const order = shownOf(result).map((a) => a.url);
  assert.equal(order[0], "https://a.test/fresh", "the fresh item leads");
  const backfilled = result.recent.filter((a) => a.homepageBackfill).map((a) => a.url);
  assert.deepEqual(backfilled, ["https://a.test/newer", "https://raaey.test/older", "https://a.test/lower"]);
});

test("target 10: the backfill tops up to exactly 10 and stops, even with more qualifying items", () => {
  const now = Date.now();
  const categories = ["telco", "telco", "telco", "telco", "energy", "energy", "energy", "energy", "infrastructure", "infrastructure", "infrastructure", "deals", "deals", "tenders", "tenders", "tenders"];
  const older = categories.map((category, i) => article({
    url: `https://a.test/older-${i}`, title: `Ανακοίνωση έργου δικτύου αρ. ${i}`, sourceId: `older-src-${i}`,
    categories: [category], score: 15, publishedAt: iso(now, 4 + i * 0.15),
  }));
  const shown = shownOf(buildHomepageSections(older, { now }));
  assert.equal(shown.length, HOMEPAGE_TARGET_ITEMS);
  assert.ok(shown.every((a) => a.homepageBackfill));
});

test("no padding: with only 3 qualifying older items the homepage shows 3, not 10 (empty slots stay empty)", () => {
  const now = Date.now();
  const qualifying = [0, 1, 2].map((i) => article({
    url: `https://a.test/ok-${i}`, title: `Ανακοίνωση έργου δικτύου αρ. ${i}`, sourceId: `ok-src-${i}`,
    categories: [["telco", "energy", "infrastructure"][i]], score: 15, publishedAt: iso(now, 4 + i),
  }));
  const tooLow = Array.from({ length: 6 }, (_, i) => article({
    url: `https://a.test/low-${i}`, title: `Ανακοίνωση έργου δικτύου χαμηλής βαθμολογίας ${i}`, sourceId: `low-src-${i}`,
    categories: [["tenders", "regulators", "deals", "telco", "energy", "infrastructure"][i]], score: 9, publishedAt: iso(now, 4),
  }));
  const tooOld = article({
    url: "https://a.test/old", title: PLAIN_TITLE, sourceId: "old-src", categories: ["energy"], score: 80, publishedAt: iso(now, 9),
  });
  const shown = shownOf(buildHomepageSections([...qualifying, ...tooLow, tooOld], { now }));
  assert.equal(shown.length, 3);
  assert.deepEqual(shown.map((a) => a.url).sort(), qualifying.map((a) => a.url).sort());
});

test("fresh items may still exceed 10: no backfill, and HOMEPAGE_MAX_ITEMS (20) stays the ceiling", () => {
  const now = Date.now();
  const categories = ["telco", "telco", "telco", "telco", "energy", "energy", "energy", "energy", "infrastructure", "infrastructure", "infrastructure", "tenders", "tenders", "tenders", "regulators", "regulators", "regulators", "deals", "deals"];
  const fresh = categories.map((category, i) => article({
    url: `https://a.test/fresh-${i}`, title: `Νέο έργο δικτύου οπτικών ινών #${i}`, sourceId: `fresh-src-${i}`,
    categories: [category], score: 12, publishedAt: iso(now, 0.05),
  }));
  const older = article({ url: "https://a.test/older", title: PLAIN_TITLE, sourceId: "older-src", categories: ["energy"], score: 99, publishedAt: iso(now, 4) });
  const shown = shownOf(buildHomepageSections([...fresh, older], { now }));
  assert.ok(shown.length > HOMEPAGE_TARGET_ITEMS && shown.length <= HOMEPAGE_MAX_ITEMS, `got ${shown.length}`);
  assert.ok(!shown.some((a) => a.homepageBackfill));
});

test("buildReviewDump: homepage items carry homepageBackfillTier1 and the dump reports homepageTargetItems", () => {
  const NOW = new Date("2026-10-25T12:00:00Z").getTime();
  const report = {
    scannedAt: "2026-10-25T10:00:00.000Z", fetched: 1, relevant: 1, sources: [],
    items: [{
      url: "https://raaey.test/consultation", title: CONSULTATION, summary: "",
      sourceId: "raaey-energy-announcements", publishedAt: iso(NOW, 15), score: 20, relevance: [], metadata: {},
    }],
  };
  const dump = buildReviewDump(report, { now: NOW });
  assert.equal(dump.header.rules.homepageTargetItems, HOMEPAGE_TARGET_ITEMS);
  const shown = [dump.homepage.lead, ...dump.homepage.recent, ...Object.values(dump.homepage.columns).flat()].filter(Boolean);
  for (const item of shown) assert.equal(typeof item.homepageBackfillTier1, "boolean");
});
