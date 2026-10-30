import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_CATEGORIES } from "../src/public-data.js";
import { NAV_SECTIONS } from "../src/landing/copy.js";
import { buildNavItems } from "../src/landing/nav.js";
import { sectionTitle } from "../src/landing/public-copy.js";
import { buildPublicSitemapEntries } from "../src/app/sitemap.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(ROOT, relativePath), "utf8");

// Approved order (Dimitris, 30 Oct 2026): Telecom, Energy, Infra, Regulators, Tenders, Deals,
// then Insights and Search in the nav.
const ORDER = ["telco", "energy", "infrastructure", "regulators", "tenders", "deals"];
const LABELS = {
  el: [
    "Τηλεπικοινωνίες & Οπτικές Ίνες",
    "Ενέργεια & Δίκτυα",
    "Υποδομές & Έργα",
    "Ρυθμιστές & Πολιτική",
    "Διαγωνισμοί & Συμβάσεις",
    "Συμφωνίες & Εταιρείες",
  ],
  en: [
    "Telecom & fibre",
    "Energy & grids",
    "Infrastructure & works",
    "Regulators & policy",
    "Tenders & contracts",
    "Deals & companies",
  ],
};
const ALL_SHOWN = Object.fromEntries(ORDER.map((slug) => [slug, { shown: true }]));

test("PUBLIC_CATEGORIES has the fixed section order (homepage columns, search filter, section routes)", () => {
  assert.deepEqual(Object.keys(PUBLIC_CATEGORIES), ORDER);
});

test("NAV_SECTIONS follows the same order (nav, footer, homepage tiles)", () => {
  assert.deepEqual(NAV_SECTIONS.map((s) => s.slug), ORDER);
});

test("nav: six sections in order, then Insights and Search, in EL and EN", () => {
  for (const lang of ["el", "en"]) {
    const items = buildNavItems({ lang, navVisibility: ALL_SHOWN, active: null });
    assert.deepEqual(items.map((i) => i.key), [...ORDER, "insights", "search"], lang);
    assert.deepEqual(items.slice(0, ORDER.length).map((i) => i.label), LABELS[lang], lang);
    assert.equal(items.length, 8);
  }
});

test("held-back sections drop out of the nav without changing the order of the rest", () => {
  const items = buildNavItems({ lang: "el", navVisibility: { regulators: { shown: false } }, active: null });
  assert.deepEqual(items.map((i) => i.key), ["telco", "energy", "infrastructure", "tenders", "deals", "insights", "search"]);
});

test("homepage: column order and tile order resolve to the approved titles in EL and EN", () => {
  for (const lang of ["el", "en"]) {
    assert.deepEqual(Object.keys(PUBLIC_CATEGORIES).map((slug) => sectionTitle(slug, lang)), LABELS[lang], `${lang} columns`);
    assert.deepEqual(NAV_SECTIONS.map((s) => sectionTitle(s.slug, lang)), LABELS[lang], `${lang} tiles`);
  }
  // HomePage draws columns from PUBLIC_CATEGORIES and tiles from NAV_SECTIONS, with no sort of its own.
  const home = read("src/components/public/HomePage.js");
  assert.ok(home.includes("Object.keys(PUBLIC_CATEGORIES)"));
  assert.ok(home.includes("NAV_SECTIONS.filter("));
  assert.ok(!/\.sort\(/.test(home));
});

test("footer and sitemap use the same order", () => {
  assert.ok(read("src/components/landing/LandingFooter.js").includes("NAV_SECTIONS.filter("));
  const paths = buildPublicSitemapEntries("https://x.test", ALL_SHOWN).map((e) => e.url.replace("https://x.test/", ""));
  assert.deepEqual(paths.filter((p) => ORDER.includes(p)), ORDER);
  assert.deepEqual(paths.filter((p) => p.startsWith("en/") && ORDER.includes(p.slice(3))).map((p) => p.slice(3)), ORDER);
});
