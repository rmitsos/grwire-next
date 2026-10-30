import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_CATEGORIES } from "../src/public-data.js";
import { NAV_SECTIONS } from "../src/landing/copy.js";
import { buildNavItems } from "../src/landing/nav.js";

const ORDER = ["telco", "energy", "infrastructure", "regulators", "tenders", "deals"];

test("PUBLIC_CATEGORIES has the fixed section order", () => {
  assert.deepEqual(Object.keys(PUBLIC_CATEGORIES), ORDER);
});

test("NAV_SECTIONS follows the same order", () => {
  assert.deepEqual(NAV_SECTIONS.map((s) => s.slug), ORDER);
});

test("buildNavItems lists sections in that order, then Insights and Search", () => {
  const visibility = Object.fromEntries(ORDER.map((slug) => [slug, { shown: true }]));
  for (const lang of ["el", "en"]) {
    const items = buildNavItems({ lang, navVisibility: visibility, active: null });
    assert.deepEqual(items.slice(0, ORDER.length).map((i) => i.key), ORDER);
    assert.equal(items.length, ORDER.length + 2);
  }
});
