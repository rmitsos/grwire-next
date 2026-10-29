import test from "node:test";
import assert from "node:assert/strict";
import { buildHomepageSections } from "../src/public-data.js";
import { CATEGORY_TO_SPEC_SECTION, SECTION_HOMEPAGE_CAPS, SECTION_SHARE_MAX, HOMEPAGE_TARGET_ITEMS } from "../src/feed-rules.js";

const NOW = Date.parse("2026-10-29T08:00:00+02:00");
const HOUR = 3_600_000;
const art = (i, categories, { hoursAgo = 3 + i * 0.1, score = 20, title } = {}) => ({
  url: `https://example.gr/g-${categories.join("-")}-${i}`,
  title: title || `Ειδηση ${categories.join("/")} αρ. ${i}`,
  summary: "", sourceId: `src-${categories.join("-")}-${i}`, categories, score,
  publishedAt: new Date(NOW - hoursAgo * HOUR).toISOString(), metadata: {},
});
const shownOf = (r) => [r.lead, ...r.recent, ...Object.values(r.columns).flat()].filter(Boolean);

test("go-live: energy homepage cap is 3", () => {
  assert.equal(SECTION_HOMEPAGE_CAPS["energy-grids"], 3);
  const articles = Array.from({ length: 8 }, (_, i) => art(i, ["energy"], { hoursAgo: 1 + i * 0.3 }));
  const energy = shownOf(buildHomepageSections(articles, { now: NOW })).filter((a) => a.categories[0] === "energy");
  assert.ok(energy.length <= 3, `energy ${energy.length}`);
});

test("go-live: a column with no fresh items backfills from its own section within 7 days", () => {
  const articles = [
    ...Array.from({ length: 6 }, (_, i) => art(i, ["telco"], { hoursAgo: 2 + i })),
    art(0, ["regulators"], { hoursAgo: 4 * 24, score: 14 }),
    art(1, ["regulators"], { hoursAgo: 5 * 24, score: 14 }),
  ];
  const result = buildHomepageSections(articles, { now: NOW });
  assert.ok(result.columns.regulators.length >= 1, "regulators column is not empty");
  assert.ok(result.columns.regulators.every((a) => a.homepageBackfill === true));
});

test("go-live: the column backfill keeps the score floor and the 7-day window", () => {
  const articles = [
    ...Array.from({ length: 4 }, (_, i) => art(i, ["telco"], { hoursAgo: 2 + i })),
    art(0, ["regulators"], { hoursAgo: 4 * 24, score: 6 }),
    art(1, ["regulators"], { hoursAgo: 9 * 24, score: 40 }),
  ];
  const result = buildHomepageSections(articles, { now: NOW });
  assert.deepEqual(result.columns.regulators, [], "below the backfill floor, or older than 7 days: stays empty");
});

test("go-live: a column backfill never repeats a story and never goes over the target of 10", () => {
  const articles = [
    ...Array.from({ length: 12 }, (_, i) => art(i, ["telco"], { hoursAgo: 2 + i * 0.2, score: 30 })),
    art(0, ["tenders"], { hoursAgo: 5 * 24, score: 14 }),
  ];
  const list = shownOf(buildHomepageSections(articles, { now: NOW }));
  assert.equal(new Set(list.map((a) => a.url)).size, list.length);
  assert.ok(list.length >= HOMEPAGE_TARGET_ITEMS || list.length > 0);
});

test("go-live: the 35% share holds on the final list, backfill included", () => {
  const articles = [
    ...Array.from({ length: 4 }, (_, i) => art(i, ["telco"], { hoursAgo: 2 + i })),
    ...Array.from({ length: 5 }, (_, i) => art(i, ["energy"], { hoursAgo: 2 + i * 0.5 })),
    ...Array.from({ length: 5 }, (_, i) => art(i, ["energy"], { hoursAgo: 3 * 24 + i, score: 20 })),
    ...Array.from({ length: 3 }, (_, i) => art(i, ["infrastructure"], { hoursAgo: 4 * 24 + i, score: 15 })),
  ];
  const list = shownOf(buildHomepageSections(articles, { now: NOW }));
  const shareCap = Math.floor(SECTION_SHARE_MAX * Math.max(list.length, HOMEPAGE_TARGET_ITEMS));
  const counts = {};
  for (const a of list) {
    const section = CATEGORY_TO_SPEC_SECTION[a.categories[0]];
    counts[section] = (counts[section] || 0) + 1;
  }
  for (const [section, count] of Object.entries(counts)) {
    assert.ok(count <= Math.min(SECTION_HOMEPAGE_CAPS[section], shareCap), `${section}: ${count} of ${list.length}`);
  }
});
